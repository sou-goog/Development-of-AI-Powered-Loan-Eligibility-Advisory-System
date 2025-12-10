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
import re
import os
import uuid
import base64
import numpy as np
import websockets
from typing import List, Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from dotenv import load_dotenv

# Database
from app.models.database import get_db, LoanApplication
from sqlalchemy.orm import Session
from datetime import datetime

# Cloud APIs
from groq import AsyncGroq
# We keep DeepgramClient for REST/TTS, but use direct websockets for Streaming STT
from deepgram import DeepgramClient
from app.services.ml_model_service import MLModelService 

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
GROQ_MODEL = "llama-3.1-8b-instant" 

if not GROQ_API_KEY or not DEEPGRAM_API_KEY:
    logger.error("Missing GROQ_API_KEY or DEEPGRAM_API_KEY in .env")

# Initialize Clients
groq_client = AsyncGroq(api_key=GROQ_API_KEY)
# Used for TTS (REST)
deepgram_client = DeepgramClient(api_key=DEEPGRAM_API_KEY)
ml_service = MLModelService() # Initialize ML Service
import requests
tts_session = requests.Session() # Global persistent session for TTS speed

async def get_groq_client():
    return groq_client

# System prompt
LOAN_AGENT_PROMPT = """You are LoanVoice, a friendly and efficient voice assistant for loan eligibility assessment.

Your Goal: Collect exactly these 6 fields. Do not stop until you have them all.
CHECKLIST:
1. Full Name
2. Monthly Income
3. Credit Score
4. Loan Amount Requested
7. Employment Type (Salaried / Business)
8. Loan Purpose (e.g., Personal, Home)
9. Existing Monthly EMI (if any, else 0)
10. Marital Status (Single / Married)

Instructions:
1. Look at 'CURRENT KNOWN INFO'. If a field is present, DO NOT ASK FOR IT AGAIN.
2. Only ask for ONE missing field at a time.
3. If the user provides a value, extracted it into the JSON block.
4. Greet the user first if 'name' is missing.
5. Once ALL 6 fields are present in 'CURRENT KNOWN INFO', IMMEDIATELY say "Checking to see if you are eligible..." and output the full JSON.
6. If user input clarifies a previous field (e.g., "Salaried"), update it.

CRITICAL INSTRUCTION:
At the very end of your response, you MUST append the extracted data in JSON format, separated by '|||'.
Format:
<Natural Language Response>
|||
|||
{"name": "...", "monthly_income": 1000, "credit_score": 750, "loan_amount": 5000, "employment_type": "Salaried", "loan_purpose": "Personal", "existing_emi": 200, "marital_status": "Single"}

IMPORTANT: Do NOT use markdown code blocks (```json). Just raw JSON.
If a field is unknown, omit it from the JSON. Always output the JSON block containing ANY new or updated fields.
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
             return tts_session.post(url, headers=headers, json=payload, timeout=5)
             
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
    deepgram_url = "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&numerals=true&interim_results=true&utterance_end_ms=1500&vad_events=true&endpointing=600"
    
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
                logger.info("SENDER TASK STARTED")
                try:
                    chunk_count = 0
                    while True:
                        try:
                            # KeepAlive Logic: Wait for message with timeout
                            try:
                                # logger.info("Waiting for WebSocket message...")
                                message = await asyncio.wait_for(websocket.receive(), timeout=5.0)
                            except asyncio.TimeoutError:
                                # Send KeepAlive to Deepgram to prevent net0001
                                await dg_socket.send(json.dumps({"type": "KeepAlive"}))
                                continue

                            # logger.info(f"Received message type: {message.keys()}")
                            
                            # DIAGNOSTIC LOGGING (Safe)
                            if "bytes" in message:
                                pass 
                            elif "text" in message:
                                logger.info(f"WS RX: Text ({len(message['text'])} chars): {message['text'][:100]}")

                            # PROCESSING
                            if "bytes" in message:
                                chunk = message["bytes"]
                                chunk_count += 1
                                # VERBOSE LOGGING ENABLED
                                logger.info(f"Audio chunk #{chunk_count} ({len(chunk)} bytes) -> Sending to Deepgram")
                                
                                try:
                                    await dg_socket.send(chunk)
                                except Exception as e:
                                    logger.error(f"Failed to send chunk #{chunk_count} to Deepgram: {e}")
                                    break
                            
                            elif "text" in message:
                                try:
                                    data_json = json.loads(message["text"])
                                    if isinstance(data_json, dict):
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
                                            
                                            # Send KeepAlive to Deepgram (Prevent Net0001 Timeout)
                                            await dg_socket.send(json.dumps({"type": "KeepAlive"}))
                                            
                                            await websocket.send_json({"type": "final_transcript", "data": text})
                                            
                                            # DIAGNOSTIC: Test ML service directly
                                            if "TEST123" in text.upper():
                                                logger.error("!!! DIAGNOSTIC TEST TRIGGERED !!!")
                                                test_applicant = {
                                                    "Monthly_Income": 5000.0,
                                                    "Credit_Score": 750,
                                                    "Loan_Amount_Requested": 10000.0,
                                                    "Loan_Tenure_Years": 5,
                                                    "Existing_EMI": 0,
                                                }
                                                test_result = ml_service.predict_eligibility(test_applicant)
                                                logger.error(f"!!! TEST RESULT: {test_result} !!!")
                                                await websocket.send_json({"type": "eligibility_result", "data": test_result})
                                                continue
                                            
                                            # NON-BLOCKING: Process LLM in background so we don't freeze inputs
                                            asyncio.create_task(
                                                process_llm_response(text, websocket, conversation_history, structured_data, generate_audio=False)
                                            )
            
                                        elif data_json.get("type") == "document_uploaded":
                                            logger.info("DOCUMENT UPLOADED - Acknowledged")
                                            # Wait for user to click "Done" in frontend
                                            pass

                                        elif data_json.get("type") == "verification_completed":
                                            logger.info("VERIFICATION COMPLETED - Verifying and Re-checking Eligibility")
                                            structured_data["documents_verified"] = True
                                            # Re-run eligibility check now that docs are verified
                                            await evaluate_eligibility(structured_data, websocket, ml_service)


                                    else:
                                        logger.warning(f"Ignored non-dict JSON: {data_json}")

                                except Exception as e:
                                    logger.error(f"Error handling text message: {e}")

                        except RuntimeError:
                            logger.info("WebSocket disconnected")
                            break
                        except Exception as e:
                            logger.error(f"CRITICAL ERROR in Sender Loop: {e}")
                            # Continue loop to keep audio alive
                            continue
                except Exception as e:
                    logger.error(f"Sender Task Fatal Error: {e}")
            
            # Start Receiver Task (Deepgram Transcript -> Frontend/LLM)
            async def receiver_task():
                logger.info("RECEIVER TASK STARTED")
                llm_task = None
                try:
                    async for msg in dg_socket:
                        try:
                            # Verify msg is a valid type
                            if not isinstance(msg, (str, bytes)):
                                logger.warning(f"Ignored non-text/bytes from Deepgram: {type(msg)}")
                                continue

                            res = json.loads(msg)
                            if not isinstance(res, dict):
                                logger.warning(f"Ignored non-dict response from Deepgram: {res}")
                                continue

                            # Parse Transcript
                            if 'channel' in res:
                                channel = res['channel']
                                # Safety Check
                                if not isinstance(channel, dict):
                                    logger.warning(f"Unexpected channel type: {type(channel)} - Body: {res}")
                                    continue

                                alts = channel.get('alternatives', [])
                                if alts:
                                    sentence = alts[0]['transcript']
                                    is_final = res.get('is_final', False)
                                    
                                    if len(sentence) > 0:
                                         # logger.info(f"Deepgram transcript: {sentence}")
                                         pass
                                    
                            # Interruption Handling: Cancel previous LLM task if user speaks again
                                    if is_final and len(sentence) > 0:
                                        logger.info(f"User said: {sentence}")
                                        
                                        # Cancel previous task if still running
                                        if llm_task and not llm_task.done():
                                            logger.info("Interrupting previous LLM task...")
                                            llm_task.cancel()
                                            
                                        await websocket.send_json({"type": "final_transcript", "data": sentence})
                                        llm_task = asyncio.create_task(process_llm_response(sentence, websocket, conversation_history, structured_data))
                        except Exception as e:
                             logger.error(f"Error processing Deepgram message: {e} - RAW: {msg[:200]}")
                             continue
                    
                    logger.info("Deepgram Stream Ended (Receiver Loop Finished)")

                except Exception as e:
                    logger.error(f"Receiver Task Fatal Error: {e}")
                finally:
                    logger.info("RECEIVER TASK EXITING")

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
        except:
            pass

async def evaluate_eligibility(data: dict, websocket, ml_service):
    """
    Centralized logic to check eligibility criteria and trigger result OR document verification.
    """
    # Simply: Check strictly against 'data' which is the source of truth
    has_income = data.get("monthly_income") is not None
    has_score = data.get("credit_score") is not None
    has_amount = data.get("loan_amount") is not None
    
    # If we have all required fields
    if has_income and has_score and has_amount:
        
        # 1. VERIFICATION GATE
        # If documents are NOT verified yet, request them first
        if not data.get("documents_verified"):
            
            # Check if we already asked (to prevent spamming, optional but good UX)
            if not data.get("verification_requested"):
                logger.info("Critical Data Present -> REQUESTING DOCUMENT VERIFICATION")
                
                # Construct applicant data for frontend to pre-fill if needed
                applicant_preview = {
                    "monthly_income": data.get("monthly_income"),
                    "loan_amount": data.get("loan_amount"),
                    "credit_score": data.get("credit_score")
                }
                
                # Audio Announcement
                speech_text = "Perfect. I have all your details. I am taking you to the verification step now."
                audio = await synthesize_speech_deepgram(speech_text)
                if audio:
                    b64 = base64.b64encode(audio).decode('ascii')
                    await websocket.send_json({"type": "audio_chunk", "data": b64})

                # Create Draft Application in DB to get ID
                application_id = None
                try:
                    db = next(get_db())
                    new_app = LoanApplication(
                        full_name=data.get("name", "Voice User"),
                        monthly_income=float(data.get("monthly_income", 0)),
                        credit_score=int(data.get("credit_score", 0)),
                        loan_amount_requested=float(data.get("loan_amount", 0)),
                        # Enhanced Voice Fields
                        employment_type=data.get("employment_type", "Salaried"),
                        loan_purpose=data.get("loan_purpose", "Personal"),
                        loan_tenure_years=float(data.get("loan_tenure_years", 5)),
                        existing_emi=float(data.get("existing_emi", 0)),
                        marital_status=data.get("marital_status", "Single"),
                        # Defaults
                        email="voice_user@example.com", 
                        phone="0000000000",
                        approval_status="draft",
                        document_verified=False,
                        created_at=datetime.utcnow()
                    )
                    db.add(new_app)
                    db.commit()
                    db.refresh(new_app)
                    application_id = new_app.id
                    logger.info(f"Created Draft Application ID: {application_id}")
                except Exception as db_e:
                    logger.error(f"Failed to create draft application: {db_e}")
                    # Fallback to random ID if DB fails (unlikely)
                    application_id = 9999

                await websocket.send_json({
                    "type": "document_verification_required", 
                    "data": {
                        "structured_data": applicant_preview,
                        "message": speech_text,
                        "application_id": application_id
                    }
                })
                data["verification_requested"] = True
            return

        # 2. ELIGIBILITY CHECK (Only runs if documents_verified == True)
        if not data.get("eligibility_checked"):
            try:
                # Prepare data for ML
                income = float(data.get("monthly_income", 0))
                score = int(data.get("credit_score", 0))
                amount = float(data.get("loan_amount", 0))

                # GUARD: Prevent premature check if values are effectively zero
                if income < 100 or amount < 100 or score < 300:
                        logger.warning(f"Premature Eligibility Check blocked: Income={income}, Score={score}, Amount={amount}")
                        return

                logger.error(f"!!! DEBUG PROACTIVE CHECK !!! Income={income}, Score={score}, Amount={amount}")

                applicant = {
                    "Monthly_Income": income,
                    "Credit_Score": score,
                    "Loan_Amount_Requested": amount,
                    # Defaults
                    "Loan_Tenure_Years": 5, 
                    "Existing_EMI": 0,
                }
                
                logger.info(f"APPLICANT FOR ML: {applicant}")
                
                result = ml_service.predict_eligibility(applicant)
                data["eligibility_checked"] = True # Prevent loops
                
                # Send Success Result
                await websocket.send_json({"type": "eligibility_result", "data": result})
                
                # Verbal Announcement
                announcement = f"Based on your validated profile, you are {result['eligibility_score']*100:.0f} percent eligible."
                if result['eligibility_status'] == 'eligible':
                    announcement += " Your application looks strong."
                else:
                    announcement += " We might need to adjust the loan amount."
                    
                await websocket.send_json({"type": "assistant_transcript", "data": announcement})
                
                # Audio for announcement
                audio = await synthesize_speech_deepgram(announcement)
                if audio:
                    b64 = base64.b64encode(audio).decode('ascii')
                    await websocket.send_json({"type": "audio_chunk", "data": b64})

            except Exception as e:
                logger.error(f"Error in evaluate_eligibility: {e}")

async def process_llm_response(user_text: str, websocket: WebSocket, history: List[Dict], data: Dict, generate_audio: bool = True):
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
        
        # Buffer for sentence-level TTS
        sentence_buffer = ""
        
        async for chunk in completion:
            content = chunk.choices[0].delta.content
            if not content: continue
            
            # 1. State: Collecting JSON
            if is_collecting_json:
                json_buffer += content
                continue

            # 2. State: Streaming Text
            await websocket.send_json({"type": "ai_token", "data": content})
            full_response += content
            sentence_buffer += content
            
            # Check for JSON delimiter in the ACCUMULATED buffer
            # Check for JSON delimiter in the ACCUMULATED buffer
            if "|||" in sentence_buffer:
                parts = sentence_buffer.split("|||")
                speech_part = parts[0]
                json_part = parts[1] if len(parts) > 1 else ""
                
                # Speak the final speech part
                if speech_part.strip() and generate_audio:
                     cleaned_speech = re.sub(r'\*+|`+|\[.*?\]|\(.*?\)', ' ', speech_part)
                     audio = await synthesize_speech_deepgram(cleaned_speech)
                     if audio:
                        b64 = base64.b64encode(audio).decode('ascii')
                        await websocket.send_json({"type": "audio_chunk", "data": b64})
                
                # Switch to JSON mode
                is_collecting_json = True
                json_buffer += json_part
                sentence_buffer = "" # Clear buffer forever
                continue

            # Check for sentence delimiters (Sentence-Level Streaming) - Removed Comma to prevent chopping
            delimiters = ['. ', '? ', '! ', '.\n', '?\n', '!\n']
            if any(punct in sentence_buffer for punct in delimiters):
                for delimiter in delimiters:
                     if delimiter in sentence_buffer:
                         parts = sentence_buffer.split(delimiter)
                         # Everything except the last part is a complete sentence(s)
                         complete_sentence = delimiter.join(parts[:-1]) + delimiter.strip()
                         remainder = parts[-1]
                         
                         if complete_sentence.strip() and generate_audio:
                             # Clean and Speak IMMEDIATELLY
                             speech_chunk = re.sub(r'\*+|`+|\[.*?\]|\(.*?\)', ' ', complete_sentence)
                             logger.info(f"TTS Streaming: {speech_chunk[:30]}...")
                             
                             audio = await synthesize_speech_deepgram(speech_chunk)
                             if audio:
                                 b64 = base64.b64encode(audio).decode('ascii')
                                 await websocket.send_json({"type": "audio_chunk", "data": b64})
                         
                         sentence_buffer = remainder
                         break



        if full_response.strip():
             history.append({"role": "assistant", "content": full_response})

        # FLUSH REMAINING BUFFER (Critical for short replies like "Hello" or "Yes")
        if sentence_buffer.strip() and generate_audio:
             logger.info(f"TTS Streaming [FLUSH]: {sentence_buffer[:30]}...")
             speech_chunk = re.sub(r'\*+|`+|\[.*?\]|\(.*?\)', ' ', sentence_buffer)
             audio = await synthesize_speech_deepgram(speech_chunk)
             if audio:
                 b64 = base64.b64encode(audio).decode('ascii')
                 await websocket.send_json({"type": "audio_chunk", "data": b64})

        
        # Parse JSON
        if json_buffer:
            try:
                # Remove markdown code blocks if present
                clean_json = json_buffer.replace("```json", "").replace("```", "").strip()
                
                # Attempt 1: Direct Parse
                try:
                    extracted = json.loads(clean_json)
                except json.JSONDecodeError:
                    # Attempt 2: Regex Extraction (Soft Fallback)
                    logger.warning(f"Direct JSON parse failed. Trying Regex on: {clean_json[:50]}...")
                    match = re.search(r'(\{.*?\})', clean_json, re.DOTALL)
                    if match:
                        try:
                            extracted = json.loads(match.group(1))
                        except:
                            logger.error("Regex extracted JSON also failed to parse.")
                            extracted = {}
                    else:
                        logger.error("No JSON object found in buffer via Regex.")
                        extracted = {}
                
                # DIAGNOSTIC LOG
                logger.info(f"LLM EXTRACTED RAW: {extracted}")
                
                 # KEY NORMALIZATION (Refactored Helper Logic)
                normalized = {}
                for k, v in extracted.items():
                    k_lower = k.lower().strip().replace(" ", "_")
                    
                    # 1. Income
                    if k_lower in ["income", "monthly_income", "monthlyincome", "salary", "annual_income"]:
                         try: normalized["monthly_income"] = float(str(v).replace("$","").replace(",","")) 
                         except: pass
                    
                    # 2. Credit Score
                    elif k_lower in ["credit_score", "score", "cibil", "creditscore", "credit"]:
                         try: normalized["credit_score"] = int(str(v).replace(",",""))
                         except: pass
                         
                    # 3. Loan Amount
                    elif k_lower in ["loan_amount", "amount", "loanamount", "loan", "requested_amount"]:
                         try: normalized["loan_amount"] = float(str(v).replace("$","").replace(",",""))
                         except: pass
                         
                    # 4. Tenure
                    elif k_lower in ["loan_tenure_years", "tenure", "years", "term"]:
                         try: normalized["loan_tenure_years"] = float(v)
                         except: pass
                         
                    # 5. Name (Pass through)
                    elif k_lower == "name":
                        normalized["name"] = v
                    
                    # 6. Employment Type
                    elif k_lower in ["employment_type", "employment", "job_type"]:
                        normalized["employment_type"] = v
                        
                    # 7. Loan Purpose
                    elif k_lower in ["loan_purpose", "purpose", "reason"]:
                        normalized["loan_purpose"] = v
                        
                    # 8. Existing EMI
                    elif k_lower in ["existing_emi", "emi", "obligations", "debt"]:
                        try: normalized["existing_emi"] = float(str(v).replace("$","").replace(",",""))
                        except: pass
                        
                    # 9. Marital Status
                    elif k_lower in ["marital_status", "marital", "marriage"]:
                        normalized["marital_status"] = v

                logger.info(f"NORMALIZED CLEAN DATA: {normalized}")
                data.update(normalized)
                
                # DIAGNOSTIC: Log global data state
                logger.info(f"FINAL DATA STATE: {data}")
                
                await websocket.send_json({"type": "structured_update", "data": normalized})


                # PROACTIVE ELIGIBILITY CHECK
                await evaluate_eligibility(data, websocket, ml_service)


            except:
                logger.error(f"Failed to parse JSON: {json_buffer}")

    except Exception as e:
        logger.error(f"LLM Error: {e}")
