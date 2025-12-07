"""
Real-Time Streaming Voice Agent for AI Loan System (Cloud API Version)
======================================================================

This module implements a fully streaming, real-time voice assistant that:
1. Accepts live audio from frontend via WebSocket (PCM 16-bit 16kHz mono)
2. Transcribes in real-time using Deepgram Nova-2 (Cloud STT)
3. Streams transcripts to Groq (Llama 3) for intelligent responses
4. Converts LLM tokens to speech using Deepgram Aura (Cloud TTS)
5. Streams audio chunks back to frontend
6. Extracts structured loan data and triggers ML prediction

Tech Stack:
- STT: Deepgram Nova-2 (WebSocket Streaming)
- LLM: Groq API (Llama 3 - 70b/8b)
- TTS: Deepgram Aura (Streaming)
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
import re
from typing import List, Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv

# Cloud APIs
from groq import AsyncGroq
from deepgram import DeepgramClient, AsyncDeepgramClient, LiveTranscriptionEvents

# class LiveTranscriptionEvents: (Removed to use SDK constants)

# Try to import optional services
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
# Add file handler for debugging
fh = logging.FileHandler('backend_debug.log')
fh.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
fh.setFormatter(formatter)
logger.addHandler(fh)

router = APIRouter()

# Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
# llama3-8b-8192 is deprecated. Using llama-3.3-70b-versatile for better performance/stability
GROQ_MODEL = "llama-3.3-70b-versatile" 

if not GROQ_API_KEY or not DEEPGRAM_API_KEY:
    logger.error("Missing GROQ_API_KEY or DEEPGRAM_API_KEY in .env")

# Initialize Clients
groq_client = AsyncGroq(api_key=GROQ_API_KEY)
# Sync client for TTS (legacy/fallback)
deepgram_client = DeepgramClient(api_key=DEEPGRAM_API_KEY)
# Async client for Real-time STT streaming
deepgram_client_async = AsyncDeepgramClient(api_key=DEEPGRAM_API_KEY)

# System prompt
LOAN_AGENT_PROMPT = """You are LoanVoice, a friendly and efficient voice assistant for loan eligibility assessment.

Your job:
1. Greet the user warmly
2. Collect these required fields conversationally:
   - Full name
   - Monthly income (in dollars)
   - Credit score (300-850 range)
   - Desired loan amount (in dollars)
3. Respond in SHORT, conversational sentences (max 15 words).
4. Be casual, friendly, and efficient.
5. When you extract information, acknowledge it
6. Once all fields are collected (Name, Income, Credit Score, Amount), you MUST IMMEDIATELY say "Checking to see if you are eligible..." to proceed. DO NOT ask the user "Should I check now?". Just do it.

CRITICAL INSTRUCTION:
At the very end of your response, you MUST append the extracted data in JSON format, separated by '|||JSON|||'.
Format:
<Natural Language Response>
|||JSON|||
{"name": "...", "monthly_income": 1000, "credit_score": 750, "loan_amount": 5000}

If a field is unknown, omit it from the JSON. Always output the JSON block, even if empty.
"""

# ========================== Helper Functions ==========================

async def synthesize_speech_deepgram(text: str) -> Optional[bytes]:
    """Convert text to speech using Deepgram Aura."""
    if not text.strip():
        return None
    
    try:
        options = {
            "model": "aura-asteria-en",
            "encoding": "linear16",
            "container": "wav"
        }
        
        # Use synchronous client via run_in_executor if needed, but for now simple call is fine
        # as it is network bound (requests). Ideally should be async, but SDK is sync here.
        
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_filename = tmp.name
            
        # Call Sync Deepgram Client
        response = deepgram_client.speak.v1.save(tmp_filename, {"text": text}, options)
        
        with open(tmp_filename, "rb") as f:
            audio_data = f.read()
            
        os.unlink(tmp_filename)
        return audio_data

    except Exception as e:
        logger.error(f"Deepgram TTS error: {e}")
        return None

# ========================== WebSocket Endpoint ==========================

@router.websocket("/voice/stream")
async def voice_stream_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    session_id = str(uuid.uuid4())
    logger.info(f"Voice session started: {session_id}")
    
    # State
    conversation_history = []
    structured_data = {}
    
    # Deepgram Live Connection
    try:
        # Define Event Handlers
        # Define Event Handlers
        def on_message(self, result, **kwargs):
            try:
                sentence = result.channel.alternatives[0].transcript
                logger.info(f"Deepgram transcript (final={result.is_final}): {sentence}")
                
                if len(sentence) == 0:
                    return 
                
                if result.is_final:
                    logger.info(f"User said: {sentence}")
                    
                    async def process_async():
                        try:
                            await websocket.send_json({"type": "final_transcript", "data": sentence})
                            await process_llm_response(sentence, websocket, conversation_history, structured_data)
                        except Exception as e:
                            logger.error(f"Error processing async response: {e}")
                            
                    asyncio.create_task(process_async())
            except Exception as e:
                logger.error(f"Error in on_message: {e}")

        def on_error(self, error, **kwargs):
            logger.error(f"Deepgram Error: {error}")

        options = {
            "model": "nova-2", 
            "language": "en-US", 
            "smart_format": True, 
            "encoding": "linear16", 
            "channels": 1, 
            "sample_rate": 16000,
            "interim_results": True,
            "utterance_end_ms": 1000,
            "vad_events": True,
            "endpointing": 300
        }

        # Initialize Deepgram Live Client (Async)
        # Note: In SDK 5.3.0, use listen.v1.connect() with AsyncClient - verified in verify_deepgram.py
        
        logger.info("Connecting to Deepgram STT...")
        async with deepgram_client_async.listen.v1.connect(**options) as dg_connection:
            
            # Event Handlers
            dg_connection.on(LiveTranscriptionEvents.Transcript, on_message)
            dg_connection.on(LiveTranscriptionEvents.Error, on_error)
            dg_connection.on(LiveTranscriptionEvents.Close, lambda self, close, **kwargs: logger.info(f"Deepgram Connection Closed: {close}"))
            dg_connection.on(LiveTranscriptionEvents.Metadata, lambda self, metadata, **kwargs: logger.info(f"Deepgram Metadata: {metadata}"))
            dg_connection.on(LiveTranscriptionEvents.SpeechStarted, lambda self, speech_started, **kwargs: logger.info(f"Deepgram SpeechStarted"))
            dg_connection.on(LiveTranscriptionEvents.UtteranceEnd, lambda self, utterance_end, **kwargs: logger.info(f"Deepgram UtteranceEnd"))

            logger.info("Deepgram STT Connected.")
            
            try:
                chunk_count = 0
                logger.info("Entering WebSocket Receive Loop...")
                while True:
                    # Receive message (bytes or text)
                    try:
                        # logger.info("Waiting for websocket message...")
                        message = await websocket.receive()
                        # logger.info(f"Received message keys: {list(message.keys())}")
                    except RuntimeError:
                        logger.info("WebSocket disconnected during receive.")
                        break
                    
                    if "bytes" in message:
                        # Audio chunk
                        chunk = message["bytes"]
                        chunk_count += 1
                        if chunk_count % 10 == 0: # Log more frequently
                             logger.info(f"Audio chunk #{chunk_count} ({len(chunk)} bytes)")
                        
                        # chunk type check
                        # logger.info(f"Chunk type: {type(chunk)}")
                        
                        # Send to Deepgram using Async Client method
                        await dg_connection.send_media(chunk)
                    
                    elif "text" in message:
                        # Handle text input or control messages
                        data_json = json.loads(message["text"])
                        if data_json.get("type") == "text_input":
                            text = data_json.get("data")
                            await websocket.send_json({"type": "final_transcript", "data": text})
                            await process_llm_response(text, websocket, conversation_history, structured_data)
                        
                        elif data_json.get("type") == "document_uploaded":
                            # Logic for document upload and eligibility check
                            logger.info("Document uploaded signal received.")
                            structured_data["document_verified"] = True
                            
                            income = structured_data.get("monthly_income", 0)
                            credit = structured_data.get("credit_score", 0)
                            loan = structured_data.get("loan_amount", 0)
                            
                            missing = []
                            if not income: missing.append("monthly income")
                            if not credit: missing.append("credit score")
                            if not loan: missing.append("loan amount")
                            
                            if missing:
                                msg = f"I've verified your document. However, I still need your {', '.join(missing)} to check your eligibility. Please tell me those details."
                                eligible = False
                            else:
                                eligible = False
                                reason = ""
                                await websocket.send_json({"type": "assistant_transcript", "data": "Checking your eligibility..."})
                                
                                if ML_SERVICE_AVAILABLE:
                                    try:
                                        ml_service = MLModelService()
                                        applicant_data = {
                                            "Monthly_Income": income,
                                            "Credit_Score": credit,
                                            "Loan_Amount_Requested": loan,
                                            "Loan_Tenure_Years": 5,
                                            "Employment_Type": "Salaried",
                                            "Age": 30,
                                            "Existing_EMI": 0,
                                            "Document_Verified": 1
                                        }
                                        result = ml_service.predict_eligibility(applicant_data)
                                        eligible = result["eligibility_status"] == "eligible"
                                        score = result["eligibility_score"]
                                        
                                        if eligible:
                                            msg = f"Great! I've verified your document. Based on our AI analysis, you are eligible for the loan with a confidence score of {int(score*100)}%. A manager will review your application shortly."
                                        else:
                                            msg = f"I've verified your document. However, based on our AI analysis, we cannot approve the full amount at this time. Your eligibility score is {int(score*100)}%."
                                    except Exception as e:
                                        logger.error(f"ML Prediction failed: {e}")
                                        if credit >= 650 and income >= 1000:
                                            eligible = True
                                            msg = f"Great! I've verified your document. You meet our basic criteria for the ${loan} loan."
                                        else:
                                            msg = f"I've verified your document. Unfortunately, based on your credit score, we cannot approve the full amount."
                                else:
                                    if credit >= 650 and income >= 1000:
                                        eligible = True
                                        msg = f"Great! I've verified your document. You meet our basic criteria for the ${loan} loan."
                                    else:
                                        msg = f"I've verified your document. Unfortunately, based on your credit score, we cannot approve the full amount."
                                
                                # Save to Database
                                application_id = None
                                try:
                                    from app.models.database import SessionLocal, LoanApplication
                                    from datetime import datetime
                                    db = SessionLocal()
                                    new_app = LoanApplication(
                                        full_name=structured_data.get("name", "Voice User"),
                                        monthly_income=float(income),
                                        credit_score=int(credit),
                                        loan_amount_requested=float(loan),
                                        loan_tenure_years=5,
                                        employment_type="Salaried",
                                        eligibility_status="eligible" if eligible else "ineligible",
                                        eligibility_score=float(score) if ML_SERVICE_AVAILABLE else (0.9 if eligible else 0.4),
                                        debt_to_income_ratio=float(result.get("debt_to_income_ratio", 0.0)) if ML_SERVICE_AVAILABLE else 0.0,
                                        document_verified=True,
                                        created_at=datetime.utcnow()
                                    )
                                    db.add(new_app)
                                    db.commit()
                                    db.refresh(new_app)
                                    application_id = new_app.id
                                    db.close()
                                except Exception as e:
                                    logger.error(f"Failed to save application to DB: {e}")

                                await websocket.send_json({
                                    "type": "eligibility_result", 
                                    "data": {
                                        "eligible": eligible, 
                                        "message": msg,
                                        "application_id": application_id,
                                        "score": score if ML_SERVICE_AVAILABLE else 0
                                    }
                                })
                            
                            await websocket.send_json({"type": "assistant_transcript", "data": msg})
                            conversation_history.append({"role": "assistant", "content": msg})
                            
                            audio = await synthesize_speech_deepgram(msg)
                            if audio:
                                b64 = base64.b64encode(audio).decode('ascii')
                                await websocket.send_json({"type": "audio_chunk", "data": b64})
            
            except WebSocketDisconnect:
                logger.info(f"Voice session ended: {session_id}")
            except Exception as e:
                logger.error(f"Error in voice session: {e}", exc_info=True)
            finally:
                # Context manager handles disconnect automatically? 
                # Or we might want to log.
                pass

    except Exception as e:
        logger.error(f"Connection setup failed: {e}", exc_info=True)
        try:
             await websocket.close()
        except: pass

async def process_llm_response(user_text: str, websocket: WebSocket, history: List[Dict], data: Dict):
    """Process user text with Groq LLM and stream response."""
    
    # Update history
    history.append({"role": "user", "content": user_text})
    
    # Build prompt with State Injection
    current_state_str = json.dumps(data, indent=2)
    
    system_prompt = LOAN_AGENT_PROMPT + f"\n\nCURRENT KNOWN INFO:\n{current_state_str}\n\n(If a field is present in KNOWN INFO, do NOT ask for it again. HOWEVER, if the user explicitly CORRECTS or UPDATES a field, you MUST update it in the JSON output. If the user just provided it, acknowledge it.)"
    
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history[-10:]) # Keep last 10 messages
    
    try:
        completion = await groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            stream=True,
            temperature=0.7,
            max_tokens=1024
        )
        
        full_response = ""
        sentence_buffer = ""
        json_buffer = ""
        is_collecting_json = False
        
        async for chunk in completion:
            content = chunk.choices[0].delta.content
            if not content:
                continue
                
            # Check for delimiter
            if "|||JSON|||" in content:
                parts = content.split("|||JSON|||")
                text_part = parts[0]
                json_part = parts[1] if len(parts) > 1 else ""
                
                full_response += text_part
                sentence_buffer += text_part
                await websocket.send_json({"type": "ai_token", "data": text_part})
                
                is_collecting_json = True
                json_buffer += json_part
                continue
            
            if is_collecting_json:
                json_buffer += content
            else:
                full_response += content
                sentence_buffer += content
                await websocket.send_json({"type": "ai_token", "data": content})
                
                # Sentence splitting for TTS
                if re.search(r'[.!?]\s', sentence_buffer):
                    parts = re.split(r'([.!?])', sentence_buffer)
                    to_speak = ""
                    for i in range(0, len(parts) - 1, 2):
                        sentence = parts[i] + parts[i+1]
                        to_speak += sentence
                    
                    if to_speak.strip():
                        audio = await synthesize_speech_deepgram(to_speak)
                        if audio:
                            b64 = base64.b64encode(audio).decode('ascii')
                            await websocket.send_json({"type": "audio_chunk", "data": b64})
                    
                    sentence_buffer = parts[-1]

        # Speak remainder
        if sentence_buffer.strip() and not is_collecting_json:
             audio = await synthesize_speech_deepgram(sentence_buffer)
             if audio:
                 b64 = base64.b64encode(audio).decode('ascii')
                 await websocket.send_json({"type": "audio_chunk", "data": b64})

        # Process Extracted JSON (Robust Fallback logic)
        # Even if streaming missed the delimiter, we can find it in the full response
        json_candidate = ""
        if "|||JSON|||" in full_response:
            parts = full_response.split("|||JSON|||")
            if len(parts) > 1:
                json_candidate = parts[1]
        elif json_buffer.strip():
            json_candidate = json_buffer

        if json_candidate.strip():
            try:
                json_str = json_candidate.strip()
                match = re.search(r'\{.*\}', json_str, re.DOTALL)
                if match:
                    json_str = match.group(0)
                    try:
                        new_fields = json.loads(json_str)
                    except json.JSONDecodeError:
                        # Fallback for single quotes or Python-style dicts
                        import ast
                        new_fields = ast.literal_eval(json_str)
                    
                    if "name" in new_fields and isinstance(new_fields["name"], str):
                        if new_fields["name"].strip():
                            data["name"] = new_fields["name"].title()
                    
                    if "monthly_income" in new_fields:
                        try:
                            val_str = str(new_fields["monthly_income"]).replace(',', '').replace('$', '')
                            val = float(val_str)
                            if val > 0: data["monthly_income"] = val
                        except: pass
                    
                    if "credit_score" in new_fields:
                        try:
                            val = int(new_fields["credit_score"])
                            if 300 <= val <= 850: data["credit_score"] = val
                        except: pass
                        
                    if "loan_amount" in new_fields:
                        try:
                            val_str = str(new_fields["loan_amount"]).replace(',', '').replace('$', '')
                            val = float(val_str)
                            if val > 0: data["loan_amount"] = val
                        except: pass
                    
                    await websocket.send_json({"type": "structured_update", "data": data})
            except Exception as e:
                logger.error(f"JSON parsing failed: {e}")

        history.append({"role": "assistant", "content": full_response})
        
        # Magic Phrase Detector (Check both AI response and User input)
        magic_phrases = [
            "check your eligibility", "checking your eligibility", "verify your eligibility", "check eligibility",
            "eligibility checked", "checking eligibility", "verify identity",
            "checking to see if you are eligible", "let me check your eligibility"
        ]
        
        user_triggers = ["check my eligibility", "check eligibility", "am i eligible", "verify me"]
        
        required_fields = ["monthly_income", "credit_score", "loan_amount"]
        missing_fields = [k for k in required_fields if not data.get(k)]
        has_all_data = len(missing_fields) == 0

        logger.info(f"DEBUG TRIGGER: Data Keys={list(data.keys())}")
        logger.info(f"DEBUG TRIGGER: Missing Fields={missing_fields}")
        logger.info(f"DEBUG TRIGGER: Has All Data={has_all_data}")
        
        ai_phrase_detected = any(phrase in full_response.lower() for phrase in magic_phrases)
        user_phrase_detected = any(phrase in user_text.lower() for phrase in user_triggers)
        
        logger.info(f"DEBUG TRIGGER: AI Phrase={ai_phrase_detected}, User Phrase={user_phrase_detected}")

        if (ai_phrase_detected or user_phrase_detected) and has_all_data:
            logger.info("DEBUG TRIGGER: Sending document_verification_required")
            await websocket.send_json({
                "type": "document_verification_required",
                "data": {
                    "message": "", 
                    "structured_data": data
                }
            })

    except Exception as e:
        logger.error(f"Groq LLM error: {e}")
        await websocket.send_json({"type": "error", "data": "AI processing failed"})
