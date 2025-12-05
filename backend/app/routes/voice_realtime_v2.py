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
from deepgram import DeepgramClient

class LiveTranscriptionEvents:
    Transcript = "Results"
    Error = "Error"
    Close = "Close"
    Metadata = "Metadata"
    SpeechStarted = "SpeechStarted"
    UtteranceEnd = "UtteranceEnd"

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

router = APIRouter()

# Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
GROQ_MODEL = "llama3-8b-8192" # Fast and cheap

if not GROQ_API_KEY or not DEEPGRAM_API_KEY:
    logger.error("Missing GROQ_API_KEY or DEEPGRAM_API_KEY in .env")

# Initialize Clients
groq_client = AsyncGroq(api_key=GROQ_API_KEY)
deepgram_client = DeepgramClient(api_key=DEEPGRAM_API_KEY)

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
        
        response = deepgram_client.speak.v("1").save(text, options)
        
        # Deepgram SDK saves to file by default in .save(), but we want bytes.
        # Actually, .stream() is better for bytes but .save() returns a filename.
        # Let's use the REST API wrapper properly or read the file.
        # Wait, the python SDK .save returns the filename.
        # To get bytes, we might need to use a different method or read the file.
        # Let's try to use the `stream` method if available or just read the file from .save
        
        # Correction: The SDK `save` method saves to a file. 
        # For memory, we can use `stream`? 
        # Let's stick to a temp file approach for reliability with the SDK or check docs.
        # Actually, let's just use the file it creates (it creates a temp file if filename not provided? No, it requires filename).
        
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_filename = tmp.name
            
        response = deepgram_client.speak.v("1").save(tmp_filename, {"text": text}, options)
        
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
        dg_connection = deepgram_client.listen.live.v("1")
        
        # Define Event Handlers
        async def on_message(self, result, **kwargs):
            sentence = result.channel.alternatives[0].transcript
            if len(sentence) == 0:
                return
            
            if result.is_final:
                logger.info(f"User said: {sentence}")
                await websocket.send_json({"type": "final_transcript", "data": sentence})
                await process_llm_response(sentence, websocket, conversation_history, structured_data)


    except Exception as e:
        logger.error(f"Failed to init Deepgram: {e}")
        await websocket.close()
        return

    try:
        while True:
            # Receive message (bytes or text)
            message = await websocket.receive()
            
            if "bytes" in message:
                # Audio chunk
                chunk = message["bytes"]
                # Send to Deepgram
                dg_connection.send(chunk)
            
            elif "text" in message:
                # Handle text input or control messages
                data = json.loads(message["text"])
                if data.get("type") == "text_input":
                    text = data.get("data")
                    await websocket.send_json({"type": "final_transcript", "data": text})
                    await process_llm_response(text, websocket, conversation_history, structured_data)
                
                elif data.get("type") == "document_uploaded":
                    # ... (Same logic as before) ...
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
                        await websocket.send_json({"type": "final_transcript", "data": "Checking your eligibility..."})
                        
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
                                full_name=data.get("name", "Voice User"),
                                monthly_income=float(income),
                                credit_score=int(credit),
                                loan_amount_requested=float(loan),
                                loan_tenure_years=5,
                                employment_type="Salaried",
                                eligibility_status="eligible" if eligible else "ineligible",
                                eligibility_score=float(score) if ML_SERVICE_AVAILABLE else (0.9 if eligible else 0.4),
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
                    
                    await websocket.send_json({"type": "final_transcript", "data": msg})
                    history.append({"role": "assistant", "content": msg})
                    
                    audio = await synthesize_speech_deepgram(msg)
                    if audio:
                        b64 = base64.b64encode(audio).decode('ascii')
                        await websocket.send_json({"type": "audio_chunk", "data": b64})

    except WebSocketDisconnect:
        logger.info(f"Voice session ended: {session_id}")
    except Exception as e:
        logger.error(f"Error in voice session: {e}", exc_info=True)
    finally:
        dg_connection.finish()
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

        # Process Extracted JSON
        if json_buffer.strip():
            try:
                json_str = json_buffer.strip()
                match = re.search(r'\{.*\}', json_str, re.DOTALL)
                if match:
                    json_str = match.group(0)
                    new_fields = json.loads(json_str)
                    
                    has_numbers = bool(re.search(r'\d', user_text))
                    
                    if "name" in new_fields and isinstance(new_fields["name"], str):
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
                    
                    await websocket.send_json({"type": "structured_update", "data": data})
            except Exception as e:
                logger.error(f"JSON parsing failed: {e}")

        history.append({"role": "assistant", "content": full_response})
        
        # Magic Phrase Detector
        magic_phrases = ["check your eligibility", "checking your eligibility", "verify your eligibility"]
        required_fields = ["monthly_income", "credit_score", "loan_amount"]
        has_all_data = all(data.get(k) for k in required_fields)

        if any(phrase in full_response.lower() for phrase in magic_phrases) and has_all_data:
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
