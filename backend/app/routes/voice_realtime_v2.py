"""
Real-Time Streaming Voice Agent for AI Loan System
===================================================

This module implements a fully streaming, real-time voice assistant that:
1. Accepts live audio from frontend via WebSocket (PCM 16-bit 16kHz mono)
2. Transcribes in real-time using Vosk (offline STT)
3. Streams transcripts to Ollama LLM for intelligent responses
4. Converts LLM tokens to speech using Piper TTS in real-time
5. Streams audio chunks back to frontend
6. Logs all interactions to Supabase
7. Extracts structured loan data and triggers ML prediction

Tech Stack (100% Free):
- STT: Vosk (offline, streaming)
- LLM: Ollama with Llama 3 (streaming mode)
- TTS: Piper (fast, local, streaming)
- Database: Supabase
- Transport: FastAPI WebSocket

Author: AI Development Assistant
Date: November 2025
"""

import os
import re
import json
import uuid
import base64
import asyncio
import tempfile
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional, List
from collections import deque

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging

# Try to import dependencies (graceful degradation if not installed)
try:
    from vosk import Model, KaldiRecognizer
    VOSK_AVAILABLE = True
except ImportError:
    VOSK_AVAILABLE = False
    Model, KaldiRecognizer = None, None

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    create_client, Client = None, None

# Import ML service for predictions
try:
    from app.services.ml_model_service import MLModelService
    ML_SERVICE_AVAILABLE = True
except ImportError:
    ML_SERVICE_AVAILABLE = False
    MLModelService = None

logger = logging.getLogger(__name__)

# ========================== Configuration ==========================


async def _safe_close(ws: WebSocket):
    """Close a WebSocket safely, ignoring duplicate-close RuntimeErrors."""
    try:
        await ws.close()
    except RuntimeError:
        # Uvicorn/Starlette raises RuntimeError if close was already sent
        logger.debug("WebSocket already closed; ignoring duplicate close")
    except Exception as e:
        logger.warning(f"Unexpected error while closing websocket: {e}")


VOSK_MODEL_PATH = os.getenv("VOSK_MODEL_PATH", "./models/vosk-model-small-en-us-0.15")
PIPER_MODEL = os.getenv("PIPER_MODEL", "en_US-amy-medium")
PIPER_VOICE = os.getenv("PIPER_VOICE", "en_US-amy-medium")  # Some Piper versions use --voice
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
ML_MODEL_DIR = os.getenv("ML_MODEL_DIR", "./ml")

# System prompt for the voice agent
LOAN_AGENT_PROMPT = """You are LoanVoice, a friendly and efficient voice assistant for loan eligibility assessment.

Your job:
1. Greet the user warmly
2. Collect these required fields conversationally:
   - Full name
   - Monthly income (in dollars)
   - Credit score (300-850 range)
   - Desired loan amount (in dollars)
3. Respond in SHORT, natural sentences (max 15 words per sentence)
4. Be conversational and empathetic
5. When you extract information, acknowledge it
6. Once all fields are collected, say "I have all the information. Let me check your eligibility."

Remember: Keep responses CONCISE for voice interaction. No long paragraphs.
"""

router = APIRouter()

# ========================== Helper Functions ==========================

def get_supabase_client() -> Optional[Client]:
    """Create Supabase client if credentials available."""
    if not SUPABASE_AVAILABLE or not SUPABASE_URL or not SUPABASE_KEY:
        logger.warning("Supabase not available. Logging disabled.")
        return None
    try:
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        logger.error(f"Failed to create Supabase client: {e}")
        return None


def resolve_piper_model_setting() -> Dict[str, Optional[str]]:
    """Resolve Piper model/data-dir arguments.

    Returns a dict with keys:
      - 'model_arg': list of CLI args for model (e.g. ['--model', '/path/to/model.onnx']) or None
      - 'data_dir_arg': list of CLI args for data dir (e.g. ['--data-dir','/path']) or None

    Logic:
      - If `PIPER_MODEL` is an existing file path, use `--model <path>`.
      - Else if `<backend>/piper_voices/<PIPER_MODEL>.onnx` exists, use that as `--model`.
      - Else if `<backend>/piper_voices` exists, prefer `--data-dir <backend>/piper_voices`.
      - Else, return None for both and let caller pass the simple name to Piper (it may resolve via system data dir).
    """
    from typing import Dict
    backend_root = Path(__file__).resolve().parents[2]
    model_setting = os.getenv("PIPER_MODEL", PIPER_MODEL)

    # If absolute or relative path provided
    model_path = Path(model_setting)
    if model_path.exists():
        # Use short flag '-m' which is accepted by Piper CLI implementations
        return {"model_arg": ["-m", str(model_path)], "data_dir_arg": None}

    # Check backend-local piper_voices/<model>.onnx
    candidate = backend_root / "piper_voices" / f"{model_setting}.onnx"
    if candidate.exists():
        return {"model_arg": ["-m", str(candidate)], "data_dir_arg": None}

    # If a piper_voices directory exists, use it as data-dir
    voices_dir = backend_root / "piper_voices"
    if voices_dir.exists():
        return {"model_arg": None, "data_dir_arg": ["--data-dir", str(voices_dir)]}

    # Nothing found
    return {"model_arg": None, "data_dir_arg": None}


def parse_written_number(text: str) -> float:
    """
    Convert written numbers to numeric values.
    Examples: "five thousand" -> 5000, "seven fifty" -> 750, "twenty thousand" -> 20000
    """
    text = text.lower().strip()
    
    # Special cases for credit scores (e.g., "seven fifty" = 750)
    credit_score_shortcuts = {
        'seven fifty': 750,
        'seven hundred': 700,
        'six fifty': 650,
        'six hundred': 600,
        'eight hundred': 800,
        'seven hundred fifty': 750,
        'six hundred fifty': 650,
    }
    
    if text in credit_score_shortcuts:
        return credit_score_shortcuts[text]
    
    # Number word mappings
    ones = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 
            'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11, 
            'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
            'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19}
    
    tens = {'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
            'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90}
    
    scales = {'hundred': 100, 'thousand': 1000, 'million': 1000000}
    
    words = text.split()
    result = 0
    current = 0
    
    for word in words:
        if word in ones:
            current += ones[word]
        elif word in tens:
            current += tens[word]
        elif word in scales:
            current = (current or 1) * scales[word]
            if scales[word] >= 1000:
                result += current
                current = 0
    
    return result + current


def extract_structured_data(text: str, existing_data: Dict) -> Dict:
    """
    Extract structured loan fields from conversation text.
    
    Uses regex patterns to identify:
    - Names (capitalized words after "I'm" or "my name is")
    - Income (numbers followed by "income", "earn", "make", etc.)
    - Credit score (numbers in 300-850 range)
    - Loan amount (numbers followed by "loan", "borrow", "need", etc.)
    
    Args:
        text: User's spoken text
        existing_data: Previously extracted fields
        
    Returns:
        Updated structured data dictionary
    """
    data = existing_data.copy()
    text_lower = text.lower()
    
    # Debug logging
    logger.info(f"Extracting from text: '{text_lower}'")
    
    # Extract name (only capture 1-3 capitalized words, stop at common sentence starters)
    if "name" not in data:
        name_patterns = [
            r"(?:my name is|i'm|i am|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})(?:\s+(?:and|my|i|the|a|an|for|with|from|to|in|on|at|by|of)\b|\.|\,|$)",
            r"(?:this is|it's)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})(?:\s+(?:and|my|i|the|a|an|for|with|from|to|in|on|at|by|of)\b|\.|\,|$)",
        ]
        for pattern in name_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                name = match.group(1).strip()
                # Only take first 1-2 words as name
                name_words = name.split()[:2]
                data["name"] = " ".join(name_words)
                break
    
    # Extract monthly income
    if "monthly_income" not in data:
        income_patterns = [
            # Written numbers: "my monthly income is five thousand dollars"
            r"(?:monthly\s+)?income\s+is\s+((?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)(?:\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand))*)(?:\s+dollars?)?",
            r"(?:earn|make)\s+(?:is\s+)?((?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)(?:\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand))*)(?:\s+dollars?)?",
            # Numeric: "$5000", "5000 dollars", etc.
            r"(?:monthly\s+)?income\s+is\s+\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)",
            r"(?:earn|make|salary)\s+(?:is\s+)?\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)",
        ]
        for pattern in income_patterns:
            match = re.search(pattern, text_lower)
            if match:
                income_str = match.group(1).replace(',', '').strip()
                try:
                    # Handle written numbers - check if it contains ANY text words
                    if any(word in income_str for word in ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million']):
                        income = parse_written_number(income_str)
                    else:
                        income = float(income_str)
                    
                    if 100 <= income <= 1000000:  # Reasonable income range
                        data["monthly_income"] = income
                        break
                except (ValueError, TypeError):
                    pass
    
    # Extract credit score
    if "credit_score" not in data:
        score_patterns = [
            # Written: "my credit score is seven fifty"
            r"credit\s+score\s+is\s+((?:three|four|five|six|seven|eight)\s+(?:hundred|fifty|sixty|seventy|eighty|ninety)(?:\s+(?:one|two|three|four|five|six|seven|eight|nine))?)",
            r"credit\s+score\s+is\s+((?:three|four|five|six|seven|eight)(?:\s+hundred)?)",
            r"score\s+is\s+(seven\s+fifty|seven\s+hundred|six\s+fifty|eight\s+hundred)",
            # Numeric: "750", "credit score is 750"
            r"credit\s+score\s+is\s+(\d{3})",
            r"score\s+is\s+(\d{3})",
        ]
        for pattern in score_patterns:
            match = re.search(pattern, text_lower)
            if match:
                try:
                    score_str = match.group(1).strip()
                    # Handle written numbers
                    if any(word in score_str for word in ['three', 'four', 'five', 'six', 'seven', 'eight']):
                        score = int(parse_written_number(score_str))
                    else:
                        score = int(score_str)
                    
                    if 300 <= score <= 850:  # Valid credit score range
                        data["credit_score"] = score
                        break
                except (ValueError, TypeError):
                    pass
    
    # Extract loan amount
    if "loan_amount" not in data:
        loan_patterns = [
            # "loan amount of twenty thousand dollars"
            r"loan\s+amount\s+of\s+((?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)(?:\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand))*)(?:\s+dollars?)?",
            # Written: "i need twenty thousand dollars loan"
            r"need\s+((?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)(?:\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand))*)(?:\s+dollars?)?(?:\s+loan)?",
            r"(?:loan|borrow)(?:\s+of)?\s+((?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)(?:\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand))*)(?:\s+dollars?)?",
            # Numeric: "need $20000", "20000 dollars loan"
            r"need\s+\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)",
            r"(?:loan|borrow)(?:\s+of)?\s+\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)",
            r"loan\s+amount\s+of\s+\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)",
        ]
        for pattern in loan_patterns:
            match = re.search(pattern, text_lower)
            if match:
                amount_str = match.group(1).replace(',', '').strip()
                try:
                    # Handle written numbers - check if it contains ANY text words
                    if any(word in amount_str for word in ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million']):
                        amount = parse_written_number(amount_str)
                    else:
                        amount = float(amount_str)
                    
                    if 1000 <= amount <= 10000000:  # Reasonable loan range
                        data["loan_amount"] = amount
                        break
                except (ValueError, TypeError):
                    pass
    
    return data


async def run_ollama_stream(prompt: str, conversation_history: List[Dict]) -> asyncio.StreamReader:
    """
    Start Ollama in streaming mode and return stdout stream reader.
    
    Args:
        prompt: System prompt for the agent
        conversation_history: List of {role, content} messages
        
    Returns:
        StreamReader for reading Ollama's stdout line by line
    """
    # Build conversation context
    full_prompt = f"{prompt}\n\nConversation:\n"
    for msg in conversation_history[-5:]:  # Last 5 messages for context
        role = msg.get("role", "user")
        content = msg.get("content", "")
        full_prompt += f"{role}: {content}\n"
    
    # Start Ollama process
    try:
        proc = await asyncio.create_subprocess_exec(
            "ollama",
            "run",
            OLLAMA_MODEL,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        
        # Send prompt to stdin
        if proc.stdin:
            proc.stdin.write(full_prompt.encode('utf-8'))
            await proc.stdin.drain()
            proc.stdin.close()
        
        return proc.stdout
    except FileNotFoundError:
        logger.error("Ollama not found. Please install: https://ollama.ai")
        return None
    except Exception as e:
        logger.error(f"Ollama error: {e}")
        return None


async def synthesize_speech_piper(text: str) -> Optional[bytes]:
    """
    Convert text to speech using Piper TTS.
    
    Args:
        text: Text to synthesize
        
    Returns:
        WAV audio bytes or None if failed
    """
    if not text.strip():
        return None
    
    # Create temp file for output
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        output_path = tmp.name
    
    try:
        # Get piper executable path (try venv first, then system)
        import sys
        piper_cmd = str(Path(sys.executable).parent / "piper")
        if not Path(piper_cmd).exists():
            piper_cmd = "piper"  # Fallback to system PATH

        # Resolve model or data-dir arguments for Piper
        model_info = resolve_piper_model_setting()
        model_arg = []
        if model_info.get("model_arg"):
            model_arg = model_info.get("model_arg")
        elif model_info.get("data_dir_arg"):
            model_arg = model_info.get("data_dir_arg")
        else:
            # Fallback: pass the PIPER_MODEL raw value as the model argument (some installs use model tags)
                # Use short flag '-m' for compatibility
                model_arg = ["-m", PIPER_MODEL]

        # Try Piper CLI invocation with resolved args
        proc = await asyncio.create_subprocess_exec(
            piper_cmd,
            *model_arg,
            "--output_file", output_path,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        
        # Send text to stdin
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(input=text.encode('utf-8')),
            timeout=10.0
        )
        
        if proc.returncode != 0:
            logger.error(f"Piper TTS failed: {stderr.decode()}")
            return None
        
        # Read generated audio
        audio_data = Path(output_path).read_bytes()
        Path(output_path).unlink(missing_ok=True)
        
        return audio_data
        
    except FileNotFoundError:
        logger.error("Piper TTS not found. Install: pip install piper-tts")
        return None
    except asyncio.TimeoutError:
        logger.error("Piper TTS timeout")
        return None
    except Exception as e:
        logger.error(f"Piper TTS error: {e}")
        return None
    finally:
        # Cleanup temp file
        if Path(output_path).exists():
            Path(output_path).unlink(missing_ok=True)


def get_ml_service() -> Optional[MLModelService]:
    """Get ML model service for predictions."""
    if not ML_SERVICE_AVAILABLE:
        logger.warning("ML service not available")
        return None
    try:
        return MLModelService()
    except Exception as e:
        logger.error(f"Failed to load ML service: {e}")
        return None


async def predict_loan_eligibility(structured_data: Dict, ml_service: Optional[MLModelService]) -> Optional[Dict]:
    """
    Run ML prediction for loan eligibility.
    
    Args:
        structured_data: Extracted loan application fields (must include document_verified=True)
        ml_service: ML model service instance
        
    Returns:
        Prediction result dictionary or None
    """
    if not ml_service:
        logger.warning("ML service not available")
        return None
    
    # Check document verification first
    if not structured_data.get('document_verified', False):
        logger.warning("Document not verified - skipping prediction")
        return None
    
    # Check required fields
    required = ["monthly_income", "credit_score", "loan_amount"]
    if not all(k in structured_data for k in required):
        logger.warning(f"Missing required fields. Have: {list(structured_data.keys())}")
        return None
    
    try:
        # Prepare features for prediction with the simplified 3-field model
        features = {
            'monthly_income': float(structured_data['monthly_income']),
            'credit_score': int(structured_data['credit_score']),
            'loan_amount': float(structured_data['loan_amount']),
        }
        
        logger.info(f"Running ML prediction with features: {features}")
        
        # Run prediction using the trained model
        result = ml_service.predict_eligibility(features)
        
        logger.info(f"ML prediction result: {result}")
        return result
        
    except Exception as e:
        logger.error(f"ML prediction error: {e}", exc_info=True)
        return None


# ========================== WebSocket Endpoint ==========================

@router.websocket("/voice/stream")
async def voice_stream_endpoint(websocket: WebSocket):
    """
    Main WebSocket endpoint for real-time voice agent.
    
    Protocol:
    - Client sends: Binary audio frames (PCM16LE, 16kHz, mono)
    - Server sends: JSON messages with types:
        - partial_transcript: {"type": "partial_transcript", "data": "hello..."}
        - final_transcript: {"type": "final_transcript", "data": "hello world"}
        - ai_token: {"type": "ai_token", "data": "I"}
        - audio_chunk: {"type": "audio_chunk", "data": "<base64-wav>"}
        - structured_update: {"type": "structured_update", "data": {"name": "John"}}
        - eligibility_result: {"type": "eligibility_result", "data": 0.85}
        - error: {"type": "error", "data": "error message"}
    """
    await websocket.accept()
    
    # Session state
    session_id = str(uuid.uuid4())
    logger.info(f"Voice session started: {session_id}")
    
    # Initialize services
    supabase = get_supabase_client()
    ml_service = get_ml_service()
    
    # Initialize Vosk recognizer
    recognizer = None
    if VOSK_AVAILABLE and Path(VOSK_MODEL_PATH).exists():
        try:
            vosk_model = Model(VOSK_MODEL_PATH)
            recognizer = KaldiRecognizer(vosk_model, 16000)
            recognizer.SetWords(True)
            logger.info("Vosk recognizer initialized")
        except Exception as e:
            logger.error(f"Vosk initialization failed: {e}")
            await websocket.send_json({
                "type": "error",
                "data": "Speech recognition unavailable. Please check Vosk model."
            })
    else:
        logger.error(f"Vosk model not found at: {VOSK_MODEL_PATH}")
        await websocket.send_json({
            "type": "error",
            "data": f"Vosk model not found. Download from: https://alphacephei.com/vosk/models"
        })
    
    # Conversation state
    conversation_history: List[Dict] = []
    structured_data: Dict = {}
    user_transcript_buffer = ""
    ai_response_buffer = ""
    
    # TTS sentence buffer
    tts_queue = asyncio.Queue()
    tts_buffer = ""
    
    async def tts_worker():
        """Background worker to synthesize and stream audio chunks."""
        logger.info("TTS worker started")
        while True:
            try:
                sentence = await tts_queue.get()
                if sentence is None:  # Stop signal
                    logger.info("TTS worker received stop signal")
                    break
                
                logger.info(f"TTS: Processing sentence: {sentence[:50]}...")
                # Synthesize speech
                audio_bytes = await synthesize_speech_piper(sentence)
                if audio_bytes:
                    logger.info(f"TTS: Generated {len(audio_bytes)} bytes of audio")
                    # Encode as base64 and send
                    b64_audio = base64.b64encode(audio_bytes).decode('ascii')
                    try:
                        await websocket.send_json({
                            "type": "audio_chunk",
                            "data": b64_audio
                        })
                        logger.info("TTS: Audio chunk sent successfully")
                    except Exception as send_error:
                        logger.warning(f"Failed to send audio chunk (WebSocket closed): {send_error}")
                        break  # Stop worker if WebSocket closed
                else:
                    logger.warning(f"TTS: No audio generated for: {sentence[:50]}")
            except Exception as e:
                logger.error(f"TTS worker error: {e}")
    
    # Start TTS worker
    tts_task = asyncio.create_task(tts_worker())
    
    async def process_user_message(text: str):
        """Process finalized user message: extract data, get AI response."""
        nonlocal user_transcript_buffer, ai_response_buffer, structured_data, tts_buffer
        
        if not text.strip():
            return
        
        logger.info(f"Processing user message: '{text}'")
        
        # Add to conversation
        conversation_history.append({"role": "user", "content": text})
        user_transcript_buffer += " " + text
        
        # Check if this is a document verification message
        if "document verified" in text.lower():
            logger.info("📄 Received document verification confirmation!")
            structured_data['document_verified'] = True
            
            # Immediately run prediction
            prediction_result = await predict_loan_eligibility(structured_data, ml_service)
            if prediction_result is not None:
                eligibility_score = prediction_result.get('eligibility_score', 0.0)
                logger.info(f"✅ Eligibility result after document verification: {eligibility_score:.2%}")
                await websocket.send_json({
                    "type": "eligibility_result",
                    "data": {
                        "probability": eligibility_score,
                        "approved": prediction_result.get('eligibility_status') == 'eligible',
                        "confidence": prediction_result.get('confidence', 0.0),
                        "risk_level": prediction_result.get('risk_level', 'unknown'),
                        "recommendations": prediction_result.get('recommendations', [])
                    }
                })
                # Send acknowledgment message
                await websocket.send_json({
                    "type": "ai_token",
                    "data": "Perfect! Your document has been verified. Based on your information, "
                })
            # Don't process as normal chat message
            text = ""
        
        # Extract structured data
        old_data = structured_data.copy()
        structured_data = extract_structured_data(text, structured_data)
        
        # If new fields extracted, notify frontend
        if structured_data != old_data:
            await websocket.send_json({
                "type": "structured_update",
                "data": structured_data
            })
            logger.info(f"Extracted fields: {structured_data}")
        
        # Build context-aware prompt
        collected_info = []
        if 'name' in structured_data:
            collected_info.append(f"✓ Name: {structured_data['name']}")
        if 'monthly_income' in structured_data:
            collected_info.append(f"✓ Monthly Income: ${structured_data['monthly_income']:,}")
        if 'credit_score' in structured_data:
            collected_info.append(f"✓ Credit Score: {structured_data['credit_score']}")
        if 'loan_amount' in structured_data:
            collected_info.append(f"✓ Loan Amount: ${structured_data['loan_amount']:,}")
        
        context_prompt = LOAN_AGENT_PROMPT
        if collected_info:
            context_prompt += f"\n\nINFORMATION ALREADY COLLECTED:\n" + "\n".join(collected_info)
            context_prompt += "\n\nDo NOT ask for information that's already collected above. Only ask for missing required fields."
        
        required_fields = ["monthly_income", "credit_score", "loan_amount"]
        if all(k in structured_data for k in required_fields):
            context_prompt += "\n\n⭐ ALL REQUIRED FIELDS COLLECTED! Tell the user you're processing their eligibility now. Do NOT ask for more information."
        
        # Get AI response from Ollama
        stream = await run_ollama_stream(context_prompt, conversation_history)
        if not stream:
            await websocket.send_json({
                "type": "error",
                "data": "AI unavailable. Please ensure Ollama is running."
            })
            return
        
        # Stream AI tokens
        ai_message = ""
        try:
            while True:
                line = await asyncio.wait_for(stream.readline(), timeout=30.0)
                if not line:
                    break
                
                token = line.decode('utf-8', errors='ignore').rstrip()
                if not token:
                    continue
                
                # Send token to frontend
                await websocket.send_json({
                    "type": "ai_token",
                    "data": token
                })
                
                ai_message += token
                ai_response_buffer += token
                tts_buffer += token
                
                # If we hit sentence boundary, queue for TTS
                if token.rstrip().endswith(('.', '!', '?', ':')):
                    sentence_to_queue = tts_buffer.strip()
                    if sentence_to_queue:
                        logger.info(f"Queuing sentence for TTS: {sentence_to_queue[:50]}...")
                        await tts_queue.put(sentence_to_queue)
                    tts_buffer = ""
                
                # Also flush if buffer gets long
                elif len(tts_buffer) > 100:
                    # Find last space and split there
                    last_space = tts_buffer.rfind(' ')
                    if last_space > 0:
                        partial_to_queue = tts_buffer[:last_space].strip()
                        if partial_to_queue:
                            logger.info(f"Queuing partial for TTS: {partial_to_queue[:50]}...")
                            await tts_queue.put(partial_to_queue)
                        tts_buffer = tts_buffer[last_space:].strip()
        
        except asyncio.TimeoutError:
            logger.warning("Ollama stream timeout")
        except Exception as e:
            logger.error(f"Ollama streaming error: {e}")
        
        # Flush remaining TTS buffer
        if tts_buffer.strip():
            final_sentence = tts_buffer.strip()
            logger.info(f"Flushing final TTS buffer: {final_sentence[:50]}...")
            await tts_queue.put(final_sentence)
            tts_buffer = ""
        
        # Add AI response to conversation
        if ai_message.strip():
            conversation_history.append({"role": "assistant", "content": ai_message})
        
        # Check if we have all required fields (4 details)
        required_fields = ["name", "monthly_income", "credit_score", "loan_amount"]
        logger.info(f"Checking for all 4 details - Current data: {structured_data}")
        logger.info(f"Required fields: {required_fields}")
        has_all_fields = all(k in structured_data for k in required_fields)
        logger.info(f"Has all required? {has_all_fields}")
        
        # Check if document is already verified - if yes, run prediction
        if "document_verified" in structured_data and structured_data["document_verified"] is True:
            logger.info("📄 Document verified! Running ML prediction...")
            # Run ML prediction
            prediction_result = await predict_loan_eligibility(structured_data, ml_service)
            if prediction_result is not None:
                eligibility_score = prediction_result.get('eligibility_score', 0.0)
                logger.info(f"✅ Eligibility result: {eligibility_score:.2%}")
                await websocket.send_json({
                    "type": "eligibility_result",
                    "data": {
                        "probability": eligibility_score,
                        "approved": prediction_result.get('eligibility_status') == 'eligible',
                        "confidence": prediction_result.get('confidence', 0.0),
                        "risk_level": prediction_result.get('risk_level', 'unknown'),
                        "recommendations": prediction_result.get('recommendations', [])
                    }
                })
                logger.info(f"📊 Sent eligibility result to frontend: {eligibility_score:.2%}")
            else:
                logger.warning("⚠️ Eligibility prediction returned None")
        
        # Check if all 4 fields are collected but document NOT yet verified
        elif has_all_fields and not structured_data.get("document_verified", False):
            logger.info("✅ All 4 details collected! Requesting document verification...")
            
            # Send message to frontend to trigger document verification UI
            await websocket.send_json({
                "type": "document_verification_required",
                "data": {
                    "message": "Thank you! I have collected all your details. Please verify your document to proceed with the loan eligibility prediction.",
                    "structured_data": structured_data
                }
            })
        
        # Log to Supabase
        if supabase:
            try:
                await asyncio.to_thread(
                    lambda: supabase.table("voice_stream_sessions").insert({
                        "id": session_id,
                        "timestamp": datetime.utcnow().isoformat(),
                        "user_text": user_transcript_buffer,
                        "ai_reply": ai_response_buffer,
                        "structured_data": structured_data,
                    }).execute()
                )
            except Exception as e:
                logger.error(f"Supabase logging error: {e}")
    
    # Main WebSocket loop
    try:
        while True:
            message = await websocket.receive()
            
            # Handle binary audio frames
            if "bytes" in message:
                audio_chunk = message["bytes"]
                
                if recognizer:
                    # Feed to Vosk
                    if recognizer.AcceptWaveform(audio_chunk):
                        # Final result
                        result = json.loads(recognizer.Result())
                        text = result.get("text", "").strip()
                        
                        logger.info(f"Vosk final transcript: '{text}'")
                        
                        if text:
                            # Send final transcript
                            await websocket.send_json({
                                "type": "final_transcript",
                                "data": text
                            })
                            
                            # Process the message (with error handling to keep connection alive)
                            try:
                                await process_user_message(text)
                            except Exception as e:
                                logger.error(f"Error processing message, but keeping connection: {e}", exc_info=True)
                                await websocket.send_json({
                                    "type": "error",
                                    "data": f"Processing error: {str(e)}"
                                })
                    else:
                        # Partial result
                        partial = json.loads(recognizer.PartialResult())
                        partial_text = partial.get("partial", "").strip()
                        
                        if partial_text:
                            await websocket.send_json({
                                "type": "partial_transcript",
                                "data": partial_text
                            })
            
            # Handle text control messages
            elif "text" in message:
                try:
                    msg = json.loads(message["text"])
                    msg_type = msg.get("type")
                    
                    if msg_type == "ping":
                        await websocket.send_json({"type": "pong"})
                    
                    elif msg_type == "end_session":
                        logger.info(f"Session ended by client: {session_id}")
                        break
                    
                    elif msg_type == "manual_transcript":
                        # Allow manual text input for testing
                        text = msg.get("data", "")
                        if text:
                            await process_user_message(text)
                
                except json.JSONDecodeError:
                    logger.warning("Invalid JSON from client")
    
    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {session_id}")
    
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
    
    finally:
        # Cleanup
        await tts_queue.put(None)  # Stop TTS worker
        try:
            await asyncio.wait_for(tts_task, timeout=2.0)
        except:
            pass
        
        # Final Supabase log
        if supabase and (user_transcript_buffer or ai_response_buffer):
            try:
                await asyncio.to_thread(
                    lambda: supabase.table("voice_stream_sessions").insert({
                        "id": f"{session_id}-final",
                        "timestamp": datetime.utcnow().isoformat(),
                        "user_text": user_transcript_buffer,
                        "ai_reply": ai_response_buffer,
                        "structured_data": structured_data,
                    }).execute()
                )
            except Exception as e:
                logger.error(f"Final Supabase log error: {e}")
        
        await _safe_close(websocket)
        logger.info(f"Session closed: {session_id}")
