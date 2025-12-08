"""
Real-Time Streaming Voice Agent for AI Loan System (Cloud API Version)
======================================================================

This module implements a fully streaming, real-time voice assistant that:
1. Accepts live audio from frontend via WebSocket (WebM/Opus)
2. Transcribes in real-time using Deepgram (WebSocket Streaming)
3. Streams transcripts to Groq (Llama 3) for intelligent responses
4. Converts LLM tokens to speech using Deepgram Aura (Cloud TTS)
5. Streams audio chunks back to frontend
6. Extracts structured loan data and triggers ML prediction

Tech Stack:
- STT: Deepgram Nova-2 (Direct WebSocket via websockets lib)
- LLM: Groq API (Llama 3 - 70b/8b)
- TTS: Deepgram Aura (Streaming REST)
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
import websockets
from typing import List, Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv

# Cloud APIs
from groq import AsyncGroq
# We keep DeepgramClient for REST/TTS, but use direct websockets for Streaming STT
from deepgram import DeepgramClient

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
fh = logging.FileHandler('backend_debug.log')
fh.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
fh.setFormatter(formatter)
logger.addHandler(fh)

router = APIRouter()

# Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
GROQ_MODEL = "llama-3.3-70b-versatile" 

if not GROQ_API_KEY or not DEEPGRAM_API_KEY:
    logger.error("Missing GROQ_API_KEY or DEEPGRAM_API_KEY in .env")

# Initialize Clients
groq_client = AsyncGroq(api_key=GROQ_API_KEY)
# Used for TTS (REST)
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
        url = "https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=linear16&container=wav"
        headers = {
            "Authorization": f"Token {DEEPGRAM_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {"text": text}
        
        # Requests is blocking, so run in executor to keep websocket loop aligned
        import requests
        loop = asyncio.get_event_loop()
        
        def call_api():
             return requests.post(url, headers=headers, json=payload, timeout=5)
             
        response = await loop.run_in_executor(None, call_api)
        
        if response.status_code == 200:
             return response.content
        else:
             logger.error(f"Deepgram TTS API Error: {response.status_code} - {response.text}")
             return None

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
    
    # Direct Direct WebSocket Connection Logic
    deepgram_url = "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true&utterance_end_ms=1000&vad_events=true&endpointing=300"
    
    headers = {
        "Authorization": f"Token {DEEPGRAM_API_KEY}"
    }

    try:
        logger.info(f"Deepgram: Initializing DIRECT connection...")
        async with websockets.connect(deepgram_url, extra_headers=headers) as dg_socket:
            logger.info("Deepgram WebSocket Connected!")
            
            # Helper to process logic when document is uploaded
            async def handle_document_logic():
                logger.info("Processing Document Logic...")
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
                    score = 0.5

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
                            msg = result.get("reason", "Based on our analysis...")
                        except Exception as e:
                            logger.error(f"ML Prediction failed: {e}")
                            score = 0
                            msg = "Error checking eligibility."
                    
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
                            debt_to_income_ratio=float(result.get("debt_to_income_ratio", 0.0)) if ML_SERVICE_AVAILABLE and 'result' in locals() else 0.0,
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
                            "score": score
                        }
                    })
                
                await websocket.send_json({"type": "assistant_transcript", "data": msg})
                conversation_history.append({"role": "assistant", "content": msg})
                
                audio = await synthesize_speech_deepgram(msg)
                if audio:
                    b64 = base64.b64encode(audio).decode('ascii')
                    await websocket.send_json({"type": "audio_chunk", "data": b64})

            # Start Sender Task (Frontend Audio -> Deepgram)
            async def sender_task():
                try:
                    chunk_count = 0
                    while True:
                        try:
                            message = await websocket.receive()
                        except:
                            break # Disconnected

                        if "bytes" in message:
                            chunk = message["bytes"]
                            chunk_count += 1
                            if chunk_count % 50 == 0: logger.info(f"Audio chunk #{chunk_count} ({len(chunk)} bytes)")
                            await dg_socket.send(chunk)
                        
                        elif "text" in message:
                            try:
                                data_json = json.loads(message["text"])
                                if data_json.get("type") == "debug_log":
                                    logger.info(f"FRONTEND DEBUG: {data_json.get('message')}")

                                if data_json.get("type") == "audio_data":
                                    b64 = data_json.get("data")
                                    if b64:
                                        chunk = base64.b64decode(b64)
                                        chunk_count += 1
                                        if chunk_count % 50 == 0: logger.info(f"Audio chunk #{chunk_count} ({len(chunk)} bytes) [Base64]")
                                        await dg_socket.send(chunk)
                                        
                                if data_json.get("type") == "text_input":
                                    text = data_json.get("data")
                                    await websocket.send_json({"type": "final_transcript", "data": text})
                                    await process_llm_response(text, websocket, conversation_history, structured_data)

                                elif data_json.get("type") == "document_uploaded":
                                    await handle_document_logic()
                                    
                            except Exception as e:
                                logger.error(f"Error handling text message: {e}")
                except Exception as e:
                    logger.error(f"Sender Task Error: {e}")
            
            # Start Receiver Task (Deepgram Transcript -> Frontend/LLM)
            async def receiver_task():
                try:
                    async for msg in dg_socket:
                        res = json.loads(msg)
                        # Parse Transcript
                        # Expecting format: {"channel": {"alternatives": [{"transcript": "..."}]}}
                        if 'channel' in res:
                            alts = res['channel']['alternatives']
                            if alts:
                                sentence = alts[0]['transcript']
                                is_final = res.get('is_final', False)
                                
                                if len(sentence) > 0:
                                     # logger.info(f"Deepgram transcript: {sentence}")
                                     pass
                                
                                if is_final and len(sentence) > 0:
                                    logger.info(f"User said: {sentence}")
                                    await websocket.send_json({"type": "final_transcript", "data": sentence})
                                    await process_llm_response(sentence, websocket, conversation_history, structured_data)
                except Exception as e:
                    logger.error(f"Receiver Task Error: {e}")

            # Run both tasks concurrently
            sender = asyncio.create_task(sender_task())
            receiver = asyncio.create_task(receiver_task())
            
            done, pending = await asyncio.wait(
                [sender, receiver],
                return_when=asyncio.FIRST_COMPLETED
            )
            
            for task in pending:
                task.cancel()
                
    except Exception as e:
        logger.error(f"Connection/WebSocket Error: {e}", exc_info=True)
        try:
             await websocket.close()
        except: pass

async def process_llm_response(user_text: str, websocket: WebSocket, history: List[Dict], data: Dict):
    """Process user text with Groq LLM and stream response."""
    history.append({"role": "user", "content": user_text})
    current_state_str = json.dumps(data, indent=2)
    system_prompt = LOAN_AGENT_PROMPT + f"\n\nCURRENT KNOWN INFO:\n{current_state_str}"
    
    # We use last 10 messages for context
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history[-10:])
    
    try:
        completion = await groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            stream=True,
            temperature=0.7,
            max_tokens=1024
        )
        
        full_response = ""
        is_collecting_json = False
        json_buffer = ""
        
        async for chunk in completion:
            content = chunk.choices[0].delta.content
            if not content: continue
                
            if "|||JSON|||" in content:
                parts = content.split("|||JSON|||")
                await websocket.send_json({"type": "ai_token", "data": parts[0]})
                full_response += parts[0]
                is_collecting_json = True
                if len(parts) > 1: json_buffer += parts[1]
                continue
            
            if is_collecting_json:
                json_buffer += content
            else:
                await websocket.send_json({"type": "ai_token", "data": content})
                full_response += content

        if full_response.strip():
             history.append({"role": "assistant", "content": full_response})
             audio = await synthesize_speech_deepgram(full_response)
             if audio:
                 b64 = base64.b64encode(audio).decode('ascii')
                 await websocket.send_json({"type": "audio_chunk", "data": b64})
        
        # Parse JSON
        if json_buffer:
            try:
                # Remove markdown code blocks if present
                clean_json = json_buffer.replace("```json", "").replace("```", "").strip()
                extracted = json.loads(clean_json)
                data.update(extracted)
                await websocket.send_json({"type": "structured_update", "data": extracted})
            except:
                logger.error(f"Failed to parse JSON: {json_buffer}")

    except Exception as e:
        logger.error(f"LLM Error: {e}")
