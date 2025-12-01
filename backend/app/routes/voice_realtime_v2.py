"""
Real-Time Streaming Voice Agent for AI Loan System
===================================================

This module implements a fully streaming, real-time voice assistant that:
1. Accepts live audio from frontend via WebSocket (PCM 16-bit 16kHz mono)
2. Transcribes in real-time using Faster Whisper (Server-side STT)
3. Streams transcripts to Ollama LLM for intelligent responses
4. Converts LLM tokens to speech using Piper TTS in real-time
5. Streams audio chunks back to frontend
6. Extracts structured loan data and triggers ML prediction

Tech Stack:
- STT: Faster Whisper (server-side, optimized)
- LLM: Ollama with Llama 3.2 (streaming mode)
- TTS: Piper (fast, local, streaming)
- Transport: FastAPI WebSocket

Author: AI Development Assistant
Date: December 2025
"""

import asyncio
import json
import logging
import os
import uuid
import base64
import numpy as np
import tempfile
import re
from typing import List, Dict, Optional
from pathlib import Path
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from faster_whisper import WhisperModel

# Try to import optional services
try:
    from app.services.supabase_client import get_supabase_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    get_supabase_client = lambda: None

try:
    from app.services.ml_model_service import MLModelService
    ML_SERVICE_AVAILABLE = True
except ImportError:
    ML_SERVICE_AVAILABLE = False
    MLModelService = None

# Load env vars
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Global Whisper Model
whisper_model = None

try:
    logger.info("Loading Whisper 'tiny' model on startup...")
    # Run on CPU with int8 quantization for speed/low memory
    whisper_model = WhisperModel("tiny", device="cpu", compute_type="int8")
    logger.info("Whisper 'tiny' model loaded successfully!")
except Exception as e:
    logger.error(f"Failed to load Whisper model: {e}")

def load_whisper_model():
    pass # Already loaded

# Configuration
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
PIPER_MODEL = os.getenv("PIPER_MODEL", "en_US-amy-medium")

# System prompt
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

CRITICAL INSTRUCTION:
At the very end of your response, you MUST append the extracted data in JSON format, separated by '|||JSON|||'.
Format:
<Natural Language Response>
|||JSON|||
{"name": "...", "monthly_income": 1000, "credit_score": 750, "loan_amount": 5000}

If a field is unknown, omit it from the JSON. Always output the JSON block, even if empty.
"""

# ========================== Helper Functions ==========================

def parse_written_number(text: str) -> float:
    """Convert written numbers to numeric values."""
    text = text.lower().strip()
    
    # Special cases for credit scores
    credit_score_shortcuts = {
        'seven fifty': 750, 'seven hundred': 700, 'six fifty': 650,
        'six hundred': 600, 'eight hundred': 800, 'seven hundred fifty': 750,
        'six hundred fifty': 650,
    }
    if text in credit_score_shortcuts:
        return credit_score_shortcuts[text]
    
    return 0.0

async def synthesize_speech_piper(text: str) -> Optional[bytes]:
    """Convert text to speech using Piper TTS."""
    if not text.strip():
        return None
    
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        output_path = tmp.name
    
    try:
        # Use python -m piper to ensure we use the installed module
        import sys
        piper_cmd = [sys.executable, "-m", "piper"]
        
        # Resolve model path
        model_path = PIPER_MODEL
        if not os.path.exists(model_path):
            # Try relative to backend
            backend_root = Path(__file__).resolve().parents[2]
            model_path = str(backend_root / "models" / "piper" / "en_US-amy-medium.onnx")
        
        if not os.path.exists(model_path):
            logger.error(f"Piper model not found at {model_path}")
            return None

        cmd_args = piper_cmd + ["-m", model_path, "--output_file", output_path]
        
        proc = await asyncio.create_subprocess_exec(
            *cmd_args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(input=text.encode('utf-8')),
            timeout=5.0
        )
        
        if proc.returncode != 0:
            logger.error(f"Piper TTS failed: {stderr.decode()}")
            return None
        
        audio_data = Path(output_path).read_bytes()
        return audio_data
        
    except Exception as e:
        logger.error(f"Piper TTS error: {e}")
        return None
    finally:
        if os.path.exists(output_path):
            os.unlink(output_path)

# ========================== WebSocket Endpoint ==========================

@router.websocket("/voice/stream")
async def voice_stream_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # Ensure Whisper is loaded
    load_whisper_model()
    if not whisper_model:
        await websocket.send_json({"type": "error", "data": "Server STT model failed to load"})
        await websocket.close()
        return

    session_id = str(uuid.uuid4())
    logger.info(f"Voice session started: {session_id}")
    
    # State
    conversation_history = []
    structured_data = {}
    audio_buffer = bytearray()
    silence_frames = 0
    is_speaking = False
    
    # VAD Parameters
    FRAME_SIZE = 3200 # 0.1s at 16kHz 16-bit mono (16000 * 2 bytes * 0.1)
    SILENCE_THRESHOLD = 6 # Increased to 0.6s to prevent cutting mid-sentence
    ENERGY_THRESHOLD = 0.02 # Increased to 0.02 to reduce background noise sensitivity
    
    last_transcript = ""

    try:
        while True:
            # Receive message (bytes or text)
            message = await websocket.receive()
            
            if "bytes" in message:
                # Audio chunk
                chunk = message["bytes"]
                audio_buffer.extend(chunk)
                
                # Simple VAD on the chunk
                # Convert to float32 for energy calc
                if len(chunk) >= 2:
                    audio_np = np.frombuffer(chunk, dtype=np.int16).astype(np.float32) / 32768.0
                    energy = np.sqrt(np.mean(audio_np**2))
                    
                    if energy > ENERGY_THRESHOLD:
                        is_speaking = True
                        silence_frames = 0
                    else:
                        if is_speaking:
                            silence_frames += 1
                
                # If silence detected after speech, transcribe
                if is_speaking and silence_frames > SILENCE_THRESHOLD:
                    logger.info("Silence detected, transcribing...")
                    
                    # Transcribe audio_buffer
                    # Save to temp file for Whisper (it expects file or array)
                    # faster-whisper accepts np array directly
                    
                    full_audio_np = np.frombuffer(audio_buffer, dtype=np.int16).astype(np.float32) / 32768.0
                    
                    segments, info = whisper_model.transcribe(full_audio_np, beam_size=5, language="en")
                    
                    transcript = " ".join([segment.text for segment in segments]).strip()
                    
                    # Filter hallucinations
                    hallucinations = [
                        "you can hear me", "can you hear me", "thank you", 
                        "thanks for watching", "subtitles by", "amara.org",
                        "copyright", "all rights reserved", "what are you doing",
                        "make her bow", "doing? what are you doing"
                    ]
                    
                    is_hallucination = False
                    if not transcript:
                        is_hallucination = True
                    else:
                        clean_transcript = transcript.lower().strip(" .,!?")
                        if len(clean_transcript) < 2: # Ignore single letters
                            is_hallucination = True
                        for h in hallucinations:
                            if h in clean_transcript:
                                is_hallucination = True
                                break
                        
                        # Check for repetitive loops (e.g. "Text Text Text")
                        # 1. Simple half-split check (for 2x loops)
                        words = clean_transcript.split()
                        if len(words) >= 4:
                            mid = len(words) // 2
                            first_half = "".join(words[:mid])
                            second_half = "".join(words[mid:])
                            if first_half == second_half:
                                 is_hallucination = True
                                 logger.info(f"Detected 2x loop hallucination: {transcript}")

                        # 2. Check for 3x+ loops or short repeating phrases
                        if not is_hallucination and len(words) >= 6:
                            # Check if the first 3 words repeat later
                            phrase = " ".join(words[:3])
                            if clean_transcript.count(phrase) >= 3:
                                is_hallucination = True
                                logger.info(f"Detected 3x+ loop hallucination: {transcript}")
                            
                            # Check for "So I'm going to do that" specifically
                            if "going to do that" in clean_transcript and clean_transcript.count("going to do that") >= 2:
                                is_hallucination = True
                                logger.info(f"Detected specific loop hallucination: {transcript}")
                    
                    # Deduplicate
                    if transcript == last_transcript:
                        logger.info(f"Ignoring duplicate transcript: {transcript}")
                        is_hallucination = True

                    if not is_hallucination:
                        logger.info(f"User said: {transcript}")
                        last_transcript = transcript
                        await websocket.send_json({"type": "final_transcript", "data": transcript})
                        
                        # Process with LLM
                        await process_llm_response(transcript, websocket, conversation_history, structured_data)
                    
                    # Reset buffer
                    audio_buffer = bytearray()
                    is_speaking = False
                    silence_frames = 0
            
            elif "text" in message:
                # Handle text input or control messages
                data = json.loads(message["text"])
                if data.get("type") == "text_input":
                    text = data.get("data")
                    last_transcript = text
                    await websocket.send_json({"type": "final_transcript", "data": text})
                    await process_llm_response(text, websocket, conversation_history, structured_data)
                
                elif data.get("type") == "document_uploaded":
                    logger.info("Document uploaded signal received.")
                    structured_data["document_verified"] = True
                    
                    # Check for missing fields before calculating eligibility
                    income = structured_data.get("monthly_income", 0)
                    credit = structured_data.get("credit_score", 0)
                    loan = structured_data.get("loan_amount", 0)
                    
                    missing = []
                    if not income: missing.append("monthly income")
                    if not credit: missing.append("credit score")
                    if not loan: missing.append("loan amount")
                    
                    if missing:
                        # Ask for missing info instead of rejecting
                        msg = f"I've verified your document. However, I still need your {', '.join(missing)} to check your eligibility. Please tell me those details."
                        eligible = False # Not yet
                    else:
                        # Calculate Eligibility (Simple Rule-based for Demo)
                        eligible = False
                        if credit >= 650 and income >= 1000:
                            eligible = True
                            msg = f"Great! I've verified your document. With a credit score of {credit} and income of ${income}, you are eligible for the ${loan} loan. A manager will review your application shortly."
                        else:
                            msg = f"I've verified your document. Unfortunately, based on your credit score of {credit}, we cannot approve the full amount at this time."
                        
                        # Send result to UI only if we actually ran the check
                        await websocket.send_json({
                            "type": "eligibility_result", 
                            "data": {"eligible": eligible, "message": msg}
                        })
                    
                    # Speak the result (or the request for more info)
                    await websocket.send_json({"type": "final_transcript", "data": msg})
                    history.append({"role": "assistant", "content": msg})
                    
                    audio = await synthesize_speech_piper(msg)
                    if audio:
                        b64 = base64.b64encode(audio).decode('ascii')
                        await websocket.send_json({"type": "audio_chunk", "data": b64})

    except WebSocketDisconnect:
        logger.info(f"Voice session ended: {session_id}")
    except Exception as e:
        logger.error(f"Error in voice session: {e}", exc_info=True)
        try:
            await websocket.close()
        except: pass

async def process_llm_response(user_text: str, websocket: WebSocket, history: List[Dict], data: Dict):
    """Process user text with LLM and stream response."""
    
    # Update history
    history.append({"role": "user", "content": user_text})
    
    # Build prompt with State Injection
    current_state_str = json.dumps(data, indent=2)
    
    system_prompt = LOAN_AGENT_PROMPT + f"\n\nCURRENT KNOWN INFO:\n{current_state_str}\n\n(If a field is present in KNOWN INFO, do NOT ask for it again. HOWEVER, if the user explicitly CORRECTS or UPDATES a field, you MUST update it in the JSON output. If the user just provided it, acknowledge it.)"
    
    prompt = system_prompt + "\n\nConversation:\n"
    for msg in history[-10:]: # Keep last 10 messages for flow
        prompt += f"{msg['role']}: {msg['content']}\n"
    prompt += "assistant: "
    
    # Call Ollama
    try:
        proc = await asyncio.create_subprocess_exec(
            "ollama", "run", OLLAMA_MODEL, prompt,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        full_response = ""
        sentence_buffer = ""
        json_buffer = ""
        is_collecting_json = False
        
        # Read stream
        while True:
            line = await proc.stdout.read(1024)
            if not line:
                break
            
            chunk = line.decode('utf-8', errors='ignore')
            
            # Check for delimiter
            if "|||JSON|||" in chunk:
                parts = chunk.split("|||JSON|||")
                text_part = parts[0]
                json_part = parts[1]
                
                # Process remaining text
                full_response += text_part
                sentence_buffer += text_part
                await websocket.send_json({"type": "ai_token", "data": text_part})
                
                # Switch to JSON mode
                is_collecting_json = True
                json_buffer += json_part
                continue
            
            if is_collecting_json:
                json_buffer += chunk
            else:
                # Anti-Hallucination: Stop if LLM tries to roleplay as user
                if "user:" in chunk.lower() or "User:" in chunk:
                    logger.warning("Detected LLM hallucinating user turn. Stopping generation.")
                    # Cut off the chunk before "user:"
                    idx = chunk.lower().find("user:")
                    if idx != -1:
                        chunk = chunk[:idx]
                    
                    full_response += chunk
                    sentence_buffer += chunk
                    await websocket.send_json({"type": "ai_token", "data": chunk})
                    
                    # Kill the process
                    try:
                        proc.terminate()
                    except: pass
                    break

                full_response += chunk
                sentence_buffer += chunk
                
                # Send token to UI
                await websocket.send_json({"type": "ai_token", "data": chunk})
                
                # Check for sentence boundaries
                if re.search(r'[.!?]\s', sentence_buffer):
                    # Split into sentences
                    parts = re.split(r'([.!?])', sentence_buffer)
                    
                    # Process complete sentences
                    to_speak = ""
                    for i in range(0, len(parts) - 1, 2):
                        sentence = parts[i] + parts[i+1]
                        to_speak += sentence
                    
                    if to_speak.strip():
                        logger.info(f"Streaming TTS for: {to_speak}")
                        audio = await synthesize_speech_piper(to_speak)
                        if audio:
                            b64 = base64.b64encode(audio).decode('ascii')
                            await websocket.send_json({"type": "audio_chunk", "data": b64})
                    
                    # Keep the remainder
                    sentence_buffer = parts[-1]
        
        # Speak remaining buffer (if any text left before JSON)
        if sentence_buffer.strip() and not is_collecting_json:
             logger.info(f"Streaming TTS for remainder: {sentence_buffer}")
             audio = await synthesize_speech_piper(sentence_buffer)
             if audio:
                 b64 = base64.b64encode(audio).decode('ascii')
                 await websocket.send_json({"type": "audio_chunk", "data": b64})

        # Process Extracted JSON
        if json_buffer.strip():
            try:
                # Clean up JSON
                json_str = json_buffer.strip()
                match = re.search(r'\{.*\}', json_str, re.DOTALL)
                if match:
                    json_str = match.group(0)
                    new_fields = json.loads(json_str)
                    
                    # Validate and merge
                    # Anti-Hallucination: Only accept numeric fields if user input contains numbers
                    has_numbers = bool(re.search(r'\d', user_text))
                    
                    if "name" in new_fields and isinstance(new_fields["name"], str):
                        # Only update name if it looks like a name (not empty)
                        if new_fields["name"].strip():
                            data["name"] = new_fields["name"].title()
                    
                    if "monthly_income" in new_fields and has_numbers:
                        try:
                            val = float(str(new_fields["monthly_income"]).replace(',', ''))
                            if val > 0: data["monthly_income"] = val
                        except: pass
                    
                    if "credit_score" in new_fields and has_numbers:
                        try:
                            val = int(new_fields["credit_score"])
                            if 300 <= val <= 850: data["credit_score"] = val
                        except: pass
                    
                    if "loan_amount" in new_fields and has_numbers:
                        try:
                            val = float(str(new_fields["loan_amount"]).replace(',', ''))
                            if val > 0: data["loan_amount"] = val
                        except: pass
                    
                    # Send update
                    await websocket.send_json({"type": "structured_update", "data": data})
            except Exception as e:
                logger.error(f"JSON parsing failed: {e}")
                logger.error(f"Failed JSON buffer: {json_buffer}")

        # Add to history
        history.append({"role": "assistant", "content": full_response})
        logger.info(f"Current Structured Data: {data}")
        
        # Magic Phrase Detector for Flow Completion
        # If the agent says it has all info/checking eligibility, FORCE the trigger
        magic_phrases = ["check your eligibility", "checking your eligibility", "verify your eligibility"]
        required_fields = ["monthly_income", "credit_score", "loan_amount"]
        has_all_data = all(data.get(k) for k in required_fields)

        if any(phrase in full_response.lower() for phrase in magic_phrases) and has_all_data:
            logger.info("Magic phrase detected AND data complete! Forcing document verification.")
            await websocket.send_json({
                "type": "document_verification_required",
                "data": {
                    "message": "", # Message already spoken by agent
                    "structured_data": data
                }
            })
            
    except Exception as e:
        logger.error(f"LLM error: {e}")
        await websocket.send_json({"type": "error", "data": "AI processing failed"})
