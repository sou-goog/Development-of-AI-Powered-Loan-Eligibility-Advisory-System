"""
Chat Routes for AI-powered conversations
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.models.database import get_db, ChatSession, LoanApplication, User
from app.models.schemas import ChatRequest, ChatResponse
from app.services.llm_selector import get_llm_service
from app.services.ml_model_service import MLModelService
from app.services.report_service import ReportService
from app.services.email_service import email_service
from app.utils.logger import get_logger
from app.utils.security import decode_token
from app.services.llm_selector import get_llm_service
from app.services.conversation_service import ConversationService
import json
import re
import os

logger = get_logger(__name__)
router = APIRouter()

llm_service = get_llm_service()
ml_service = MLModelService()
report_service = ReportService()


@router.post("/message", response_model=ChatResponse)
@router.post("/message")
async def send_message(request: ChatRequest, http_req: Request, db: Session = Depends(get_db)):
    """
    Handles incoming chat messages, ensures application exists, processes AI response,
    and stores the conversation.
    """

    user_id = request.user_id
    message = request.message.strip()

    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # -------------------------------------------------------------------------
    # ALWAYS CREATE APPLICATION IF application_id IS NONE
    # -------------------------------------------------------------------------
    if request.application_id:
        application = (
            db.query(LoanApplication)
            .filter(LoanApplication.id == request.application_id)
            .first()
        )
        if not application:
            application = LoanApplication(user_id=user_id)
            db.add(application)
            db.commit()
            db.refresh(application)

    else:
        application = LoanApplication(user_id=user_id)
        db.add(application)
        db.commit()
        db.refresh(application)
        request.application_id = application.id

    svc = get_llm_service()
    conv = ConversationService(db=db)

    # -------------------------------------------------------------------------
    # SAVE USER MESSAGE
    # -------------------------------------------------------------------------
    conv.save_user_message(user_id, application.id, message)

    context = {
        "user_id": user_id,
        "application_id": application.id,
        "message": message,
        "application": application,
    }

    # -------------------------------------------------------------------------
    # LLM HEALTH CHECK â†’ FALLBACK MODE
    # -------------------------------------------------------------------------
    if not svc.health():
        reply = _fallback_single_question(context, application)
        conv.save_bot_message(user_id, application.id, reply)
        return {
            "message": reply,
            "application_id": application.id,
            "ask_followup": True,
        }

    # -------------------------------------------------------------------------
    # NORMAL AI FLOW
    # -------------------------------------------------------------------------
    try:
        reply, extracted, ask_followup = await svc.process_message(
            message, application
        )
    except Exception:
        reply = _fallback_single_question(context, application)
        conv.save_bot_message(user_id, application.id, reply)
        return {
            "message": reply,
            "application_id": application.id,
            "ask_followup": True,
        }

    # -------------------------------------------------------------------------
    # APPLY EXTRACTED FIELDS
    # -------------------------------------------------------------------------
    if extracted:
        for field, value in extracted.items():
            if hasattr(application, field):
                setattr(application, field, value)
        db.commit()

    conv.save_bot_message(user_id, application.id, reply)

    return {
        "message": reply,
        "application_id": application.id,
        "ask_followup": ask_followup,
    }


@router.post("/open", response_model=ChatResponse)
async def open_chat(request: ChatRequest, http_req: Request, db: Session = Depends(get_db)):
    """
    Open-ended chat endpoint: accept any question and let the LLM respond freely.

    The assistant is encouraged to ask clarifying follow-up questions when helpful.
    This endpoint does not trigger application-specific actions; it's for general Q&A and follow-ups.
    """
    try:
        svc = get_llm_service(provider_override=request.provider) if request.provider else llm_service

        # Identify current user (optional) for open chat history
        user_id = None
        try:
            auth = http_req.headers.get("authorization") or http_req.headers.get("Authorization")
            if auth and auth.lower().startswith("bearer "):
                token = auth.split(" ", 1)[1].strip()
                decoded = decode_token(token)
                if decoded and decoded.get("email"):
                    user = db.query(User).filter(User.email == decoded["email"]).first()
                    if user:
                        user_id = user.id
        except Exception:
            pass

        # Construct an explicit system prompt that encourages the assistant to ask clarifying
        # questions and interact with the user conversationally.
        system_prompt = (
            "You are a helpful, concise AI assistant. Answer the user's question clearly. "
            "If the user's question lacks necessary details, ask one concise clarifying question. "
            "Do not take actions on behalf of the user; simply ask or answer. Keep replies friendly and short."
        )

        # Pass lightweight application context only if provided
        context_data = None
        if request.application_id:
            application = db.query(LoanApplication).filter(LoanApplication.id == request.application_id).first()
            if application:
                context_data = {
                    "full_name": application.full_name,
                    "loan_amount": application.loan_amount,
                    "status": application.approval_status,
                }

        # Use the LLM service to generate response using system prompt + user message
        if not svc.health():
            # If LLM unhealthy, return fallback
            reply = "Sorry, the AI service is currently unavailable. Please try again later."
        else:
            # Attempt to include system prompt if the provider supports it
            # Include recent conversation history as part of context when available
            history = []
            try:
                if db is not None:
                    history = _get_conversation_history(db, application, user_id, limit=8)
            except Exception:
                history = []

            merged_context = (context_data or {}).copy() if context_data else {}
            if history:
                merged_context["history"] = history

            try:
                # Some services accept (prompt, context) shapes; the service implementations handle it
                reply = svc.generate(request.message, context=merged_context or {}, system_prompt=system_prompt)
            except TypeError:
                # Fallback for services that don't support system_prompt parameter
                combined = f"{system_prompt}\n\nUser: {request.message}"
                reply = svc.generate(combined, context=merged_context or {})

        # Heuristic: if reply ends with a question mark or contains a short question, mark ask_followup
        ask_followup = False
        try:
            clean = (reply or "").strip()
            if clean.endswith("?") or "?" in clean.splitlines()[:2]:
                ask_followup = True
        except Exception:
            ask_followup = False

        # Persist chat session minimally for history
        try:
            chat_session = ChatSession(
                user_id=user_id,
                application_id=request.application_id,
                messages=json.dumps([
                    {"role": "user", "content": request.message},
                    {"role": "assistant", "content": reply}
                ])
            )
            db.add(chat_session)
            db.commit()
        except Exception:
            logger.debug("Failed to persist open chat session; continuing")

        return {
            "message": reply,
            "application_id": request.application_id,
            "ask_followup": ask_followup,
        }

    except Exception as e:
        logger.error(f"Open chat error: {e}")
        raise HTTPException(status_code=500, detail="Open chat failed")


@router.get("/health")
async def check_chat_health():
    """Check if LLM service is available"""
    is_healthy = llm_service.health()
    provider = os.getenv("LLM_PROVIDER", "ollama")
    model = os.getenv(f"{provider.upper()}_MODEL", "default")
    
    # Get cache stats if available
    cache_stats = {}
    if hasattr(llm_service, 'get_cache_stats'):
        cache_stats = llm_service.get_cache_stats()
    
    return {
        "status": "healthy" if is_healthy else "unhealthy",
        "service": provider,
        "model": model,
        "cache": cache_stats
    }


@router.post("/admin/clear-cache")
async def clear_llm_cache():
    """Clear LLM response cache (admin endpoint)"""
    if hasattr(llm_service, 'clear_cache'):
        llm_service.clear_cache()
        return {"message": "Cache cleared successfully"}
    else:
        return {"message": "Caching not available for current LLM service"}


def _analyze_conversation(message: str, application, db: Session = None, user_id: int | None = None) -> dict:
    """
    Simple analyzer that identifies intent category.
    Removed old ChatSession merging logic completely.
    """

    msg = message.lower()

    if any(w in msg for w in ["income", "earn", "salary"]):
        return {"intent": "income"}

    if any(w in msg for w in ["name", "i am", "i'm"]):
        return {"intent": "name"}

    if "loan" in msg:
        return {"intent": "loan_amount"}

    if any(w in msg for w in ["credit", "cibil", "score"]):
        return {"intent": "credit_score"}

    if any(w in msg for w in ["email", "@"]):
        return {"intent": "email"}

    if any(w in msg for w in ["salaried", "business", "self"]):
        return {"intent": "employment"}

    return {"intent": "unknown"}



def _get_last_assistant_prompt(db: Session, application, user_id: int | None) -> str:
    """Fetch the most recent assistant message content for this application or user (pre-application)."""
    try:
        q = db.query(ChatSession)
        if application and getattr(application, 'id', None):
            q = q.filter(ChatSession.application_id == application.id)
        elif user_id:
            q = q.filter(ChatSession.user_id == user_id, ChatSession.application_id == None)  # noqa: E711
        else:
            return ""
        sess = q.order_by(ChatSession.created_at.desc()).first()
        if not sess:
            return ""
        msgs = json.loads(sess.messages) if isinstance(sess.messages, str) else (sess.messages or [])
        # Return last assistant content in that session
        for m in reversed(msgs):
            if (m or {}).get('role') == 'assistant':
                return str((m or {}).get('content') or "")
    except Exception:
        return ""
    return ""


def _infer_from_last_question(user_message: str, assistant_prompt: str) -> dict:
    """Infer which field the user's bare message likely answers, based on last assistant question."""
    if not assistant_prompt:
        return {}
    msg = user_message.strip().lower()
    # Detect plain numbers or lakh/crore units
    unit_match = re.search(r"(\d+(?:\.\d+)?)\s*(lakh|lakhs|crore|crores)", msg)
    digits = re.sub(r"\D", "", msg)
    # Annual income
    if "annual income" in assistant_prompt.lower():
        if unit_match:
            amt = float(unit_match.group(1))
            mult = 100000 if 'lakh' in unit_match.group(2) else 10000000
            return {"annual_income": int(round(amt * mult))}
        if digits and 4 <= len(digits) <= 8:
            return {"annual_income": int(digits)}
    # Loan amount
    if "loan amount" in assistant_prompt.lower():
        if unit_match:
            amt = float(unit_match.group(1))
            mult = 100000 if 'lakh' in unit_match.group(2) else 10000000
            return {"loan_amount": int(round(amt * mult))}
        if digits and 4 <= len(digits) <= 8:
            return {"loan_amount": int(digits)}
    # Credit score
    if "credit score" in assistant_prompt.lower():
        if digits and len(digits) == 3:
            val = int(digits)
            if 300 <= val <= 900:
                return {"credit_score": val}
    return {}


def _get_last_assistant_question_key(db: Session, application, user_id: int | None) -> str:
    """Fetch the last assistant 'last_question' key stored in meta from the most recent session."""
    try:
        q = db.query(ChatSession)
        if application and getattr(application, 'id', None):
            q = q.filter(ChatSession.application_id == application.id)
        elif user_id:
            q = q.filter(ChatSession.user_id == user_id, ChatSession.application_id == None)  # noqa: E711
        else:
            return ""
        sess = q.order_by(ChatSession.created_at.desc()).first()
        if not sess:
            return ""
        msgs = json.loads(sess.messages) if isinstance(sess.messages, str) else (sess.messages or [])
        for m in reversed(msgs):
            if (m or {}).get('role') == 'assistant':
                meta = (m or {}).get('meta') or {}
                if isinstance(meta, dict) and meta.get('last_question'):
                    return str(meta.get('last_question'))
    except Exception:
        return ""
    return ""


def _get_conversation_history(db: Session, application, user_id: int | None, limit: int = 6) -> list:
    """Return the last `limit` messages (role/content) for this application or user.

    Messages are returned in chronological order (oldest first).
    """
    history = []
    try:
        q = db.query(ChatSession)
        if application and getattr(application, 'id', None):
            q = q.filter(ChatSession.application_id == application.id)
        elif user_id:
            q = q.filter(ChatSession.user_id == user_id, ChatSession.application_id == None)  # noqa: E711
        else:
            return []

        sessions = q.order_by(ChatSession.created_at.desc()).limit(10).all()
        # Collect messages from most recent sessions, then take last `limit` messages overall
        msgs = []
        for s in sessions:
            try:
                mlist = json.loads(s.messages) if isinstance(s.messages, str) else (s.messages or [])
                for m in mlist:
                    if isinstance(m, dict) and m.get('role') and m.get('content'):
                        msgs.append({'role': m['role'], 'content': m['content']})
            except Exception:
                continue

        # msgs currently newest-first across sessions; reverse to chronological
        msgs = list(reversed(msgs))
        # Return the last `limit` messages
        if len(msgs) <= limit:
            history = msgs
        else:
            history = msgs[-limit:]
    except Exception:
        return []
    return history


def _generate_conversational_response(message: str, context: dict, application, svc, db: Session = None, user_id: int | None = None) -> str:
    """
    Generate a conversational AI response based on context
    """
    intent = context.get("intent")
    action = context.get("action")

    if intent == "greeting":
        response = "Hello! I'm your AI loan assistant. I'll help you apply for a loan and check your eligibility. To get started, could you please tell me your full name?"

    elif intent == "providing_info":
        collected_data = context.get("collected_data", {})
        if collected_data:
            # Acknowledge what they shared
            data_summary = []
            for k, v in collected_data.items():
                # Skip placeholder booleans like True (used to avoid re-asking)
                if isinstance(v, bool):
                    continue
                if k == "annual_income":
                    data_summary.append(f"annual income of â‚¹{v:,}")
                elif k == "loan_amount":
                    data_summary.append(f"loan amount of â‚¹{v:,}")
                elif k == "credit_score":
                    data_summary.append(f"credit score of {v}")
                elif k == "employment_status":
                    data_summary.append(f"employment as {v}")
                elif k == "num_dependents":
                    data_summary.append(f"{v} dependent{'s' if v != 1 else ''}")
                else:
                    data_summary.append(f"{k}: {v}")
            
            if data_summary:
                response = f"Thank you for sharing that information. I've noted your {', '.join(data_summary)}. "
            else:
                response = "Thank you for sharing that information. "
            
            if application:
                missing = context.get("missing_fields", [])
                if missing:
                    # Guide them to next step conversationally
                    next_field = missing[0]
                    key_map = {
                        "annual income": "annual_income",
                        "credit score": "credit_score",
                        "loan amount": "loan_amount",
                        "number of dependents": "num_dependents",
                        "employment status": "employment_status",
                    }
                    context["next_question_key"] = key_map.get(next_field, next_field)
                    if next_field == "annual income":
                        response += "To help determine the right loan amount for you, could you tell me your annual income?"
                    elif next_field == "credit score":
                        response += "Your credit score helps us understand your eligibility better. What's your current credit score?"
                    elif next_field == "loan amount":
                        response += "What loan amount are you looking to apply for?"
                    elif next_field == "number of dependents":
                        response += "How many dependents do you have? This helps us assess your financial situation."
                    elif next_field == "employment status":
                        response += "What's your current employment status? Are you salaried, self-employed, or in business?"
                    else:
                        response += f"To continue with your application, I need your {next_field}. Could you please share that?"
                else:
                    # All info collected - guide to next step
                    response += "Perfect! I have all the key information I need. Let me run a quick eligibility check to see what loan options might be available for you. This will just take a moment..."
                    # Auto-trigger eligibility check
                    context["action"] = "predict_eligibility"
            else:
                # No application yet. Guide to the next field based on what was just provided.
                collected = context.get("collected_data", {}) or {}
                if "email" in collected and "full_name" not in collected:
                    # User gave email now; don't re-ask name, move forward
                    response += "Thanks! Iâ€™ve noted your email. Could you share your annual income (in INR)?"
                    context["next_question_key"] = "annual_income"
                else:
                    # Ask for the next most helpful field
                    order = [
                        ("full_name", "What's your full name?"),
                        ("email", "What's your email address?"),
                        ("annual_income", "What's your annual income (in INR)?"),
                        ("credit_score", "What's your current credit score?"),
                        ("loan_amount", "What loan amount are you looking for (INR)?"),
                        ("employment_status", "What's your employment status (salaried, self-employed, business)?"),
                        ("num_dependents", "How many dependents do you have?"),
                    ]
                    for key, question in order:
                        if key not in collected or not collected.get(key):
                            response += f" {question}"
                            context["next_question_key"] = key
                            break
        else:
            response = "I understand you're sharing some information. Could you please be more specific about what details you'd like to provide?"

    elif intent == "loan_inquiry":
        response = "I'd be happy to help you with your loan application! To determine the best loan amount and terms for you, I need some basic information. Let's start with your annual income - this helps me understand what loan amounts might work for your situation."

    elif intent == "document_upload":
        response = "Perfect! Document verification is an important step in the loan process. Please upload your bank statement or ID proof. You can drag and drop the file or click to browse. I'll analyze it to verify your information and help complete your application."

    elif intent == "eligibility_check":
        if action == "predict_eligibility":
            response = "Excellent! I have enough information to check your loan eligibility. Let me analyze your application and see what options are available. This will just take a moment..."
        else:
            missing = context.get("missing_fields", [])
            if missing:
                next_field = missing[0]
                response = f"I need a bit more information to check your eligibility. "
                if next_field == "annual income":
                    response += "Could you tell me your annual income? This helps me determine suitable loan amounts."
                elif next_field == "credit score":
                    response += "What's your current credit score? This is important for assessing your eligibility."
                elif next_field == "loan amount":
                    response += "What loan amount are you interested in applying for?"
                elif next_field == "number of dependents":
                    response += "How many dependents do you have? This affects your financial assessment."
                elif next_field == "employment status":
                    response += "What's your employment status? Are you salaried, self-employed, or in business?"
                else:
                    response += f"Could you please provide your {next_field}?"

    elif intent == "verification":
        response = "I'll send a verification code to your email. Please check your inbox and enter the 6-digit code when prompted. This helps ensure your application is secure."

    else:
        # Use LLM for general responses
        context_data = None
        if application:
            context_data = {
                "full_name": application.full_name,
                "loan_amount": application.loan_amount,
                "status": application.approval_status
            }
        # Graceful fallback if LLM isn't available
        if not svc.health():
            response = _fallback_single_question(context, application)
        else:
            # Include recent conversation history as part of context if db is available
            history = []
            try:
                if db is not None:
                    history = _get_conversation_history(db, application, user_id, limit=8)
            except Exception:
                history = []

            # Merge context_data with history
            merged_context = (context_data or {}).copy() if context_data else {}
            if history:
                merged_context["history"] = history

            response = svc.generate(message, merged_context)
            # Guard against provider errors with a helpful fallback
            if not response or response.strip() == "" or response.lower().startswith("sorry, i'm having trouble responding right now"):
                response = _fallback_single_question(context, application)

    return response


def _fallback_single_question(context: dict, application) -> str:
    """Produce a concise, one-question fallback based on what's missing."""
    # Handle general inquiry briefly, then ask the next field
    intent = context.get("intent")
    prefix = ""
    if intent == "general_inquiry":
        prefix = (
            "I can answer your loan questions and help you apply. "
        )

    # Determine next missing field in preferred order
    order = [
        ("full_name", "What's your full name?"),
        ("email", "What's your email address?"),
        ("annual_income", "What's your annual income (in INR)?"),
        ("credit_score", "What's your current credit score?"),
        ("loan_amount", "What loan amount are you looking for (INR)?"),
        ("employment_status", "What's your employment status (salaried, self-employed, business)?"),
        ("num_dependents", "How many dependents do you have?"),
    ]

    collected = context.get("collected_data", {}) or {}
    missing_fields = []
    if application:
        # Use application-based missing fields if available
        missing_fields = _get_missing_fields(application)
        # Convert display names back to keys for matching
        display_to_key = {
            'annual income': 'annual_income',
            'credit score': 'credit_score',
            'loan amount': 'loan_amount',
            'loan term (months)': 'loan_term_months',
            'number of dependents': 'num_dependents',
            'employment status': 'employment_status',
        }
        missing_keys = [display_to_key.get(m, m) for m in missing_fields]
    else:
        missing_keys = [k for k, _ in order if not collected.get(k)]

    # Heuristic: if the current message provided an email but no name, skip asking name now
    if not application:
        collected_now = context.get("collected_data", {}) or {}
        if collected_now.get("email") and not collected_now.get("full_name"):
            missing_keys = [k for k in missing_keys if k != "full_name"]

    for key, question in order:
        if key in missing_keys:
            return f"{prefix}{question}"

    # If nothing obvious is missing, default to a simple next step
    return f"{prefix}How can I help you proceed with your application?"


async def _collect_applicant_details(message: str, application, db: Session, user_id: int | None = None):
    """
    Extracts applicant data from message and updates the application.
    Always updates the existing application and never merges old values.
    """

    extracted = _extract_data_from_message(message)

    # If nothing extracted â†’ no update
    if not extracted:
        return {
            "application_created": False,
            "new_fields": {},
            "missing_fields": [],
        }

    # Update application fields (latest wins)
    for field, value in extracted.items():
        if hasattr(application, field):
            setattr(application, field, value)

    db.commit()

    # Identify missing fields after update
    required = [
        "full_name",
        "email",
        "annual_income",
        "credit_score",
        "loan_amount",
        "employment_status",
        "num_dependents",
    ]
    missing = [f for f in required if not getattr(application, f)]

    return {
        "application_created": False,
        "new_fields": extracted,
        "missing_fields": missing,
    }



async def _perform_eligibility_check(application, db: Session):
    """
    Perform loan eligibility check using ML model
    """
    if not application:
        return {"error": "No application found"}

    # Prepare data for prediction
    applicant_data = {
        "annual_income": application.annual_income,
        "credit_score": application.credit_score,
        "loan_amount": application.loan_amount,
        "loan_term_months": application.loan_term_months,
        "num_dependents": application.num_dependents,
        "employment_status": application.employment_status
    }

    # Get prediction
    prediction = ml_service.predict_eligibility(applicant_data)

    # Update application
    application.eligibility_score = prediction["eligibility_score"]
    application.eligibility_status = prediction["eligibility_status"]
    db.commit()

    # Send notification email
    email_service.send_loan_result_notification(
        application.email,
        application.full_name,
        prediction["eligibility_score"],
        prediction["eligibility_status"]
    )

    score_percentage = round(prediction["eligibility_score"] * 100, 1)
    status_text = "eligible" if prediction["eligibility_status"] == "eligible" else "not eligible"

    return {
        "eligibility_score": prediction["eligibility_score"],
        "eligibility_status": prediction["eligibility_status"],
        "score_percentage": score_percentage,
        "status_text": status_text,
        "recommendations": prediction["recommendations"],
        "notification_sent": True
    }


async def _generate_loan_report(application, db: Session):
    """
    Generate PDF report for the loan application
    """
    if not application:
        return {"error": "No application found"}

    # Prepare application data
    app_data = {
        "id": application.id,
        "full_name": application.full_name,
        "email": application.email,
        "phone": application.phone,
        "annual_income": application.annual_income,
        "credit_score": application.credit_score,
        "loan_amount": application.loan_amount,
        "loan_term_months": application.loan_term_months,
        "num_dependents": application.num_dependents,
        "employment_status": application.employment_status,
        "eligibility_score": application.eligibility_score,
        "eligibility_status": application.eligibility_status,
        "approval_status": application.approval_status,
        "document_verified": application.document_verified,
        "manager_notes": application.manager_notes
    }

    # Generate report
    report_path = report_service.generate_report(app_data)

    # Update application
    application.report_path = report_path
    db.commit()

    return {
        "report_generated": True,
        "report_path": report_path,
        "report_url": f"/static/reports/{report_path.split('/')[-1]}"
    }


async def _send_verification_otp(application, db: Session):
    """
    Send OTP verification email
    """
    if not application or not application.email:
        return {"error": "No email address available"}

    # Generate and send OTP
    otp_code = email_service.generate_otp()
    success = email_service.send_otp_email(application.email, otp_code)

    return {
        "otp_sent": success,
        "email": application.email
    }


def _extract_data_from_message(message: str) -> dict:
    """
    Extract applicant data from natural language message
    """
    extracted = {}
    message_lower = message.lower()
    message_stripped = message.strip()

    # Extract numbers that might be income, loan amount, credit score, etc.
    import re

    # Email address
    email_match = re.search(r'([a-zA-Z0-9_.+\-]+@[a-zA-Z0-9\-]+\.[a-zA-Z0-9\-.]+)', message)
    if email_match:
        extracted["email"] = email_match.group(1)

    # Name phrases: "my name is X", "I'm X", "I am X", "This is X"
    name_phrase = re.search(r"(?:my\s+name\s+is|i\s*am|i'm|this\s+is)\s+([A-Za-z][A-Za-z\-']+(?:\s+[A-Za-z][A-Za-z\-']+){0,3})", message_lower, re.IGNORECASE)
    if name_phrase:
        name_val = name_phrase.group(1).strip()
        # Title-case the name reasonably
        extracted["full_name"] = " ".join([p.capitalize() for p in name_val.split()])

    # Name-only message fallback (restrict to Title Case names and avoid generic loan words)
    if "full_name" not in extracted:
        words = message_stripped.split()
        loan_keywords = {"loan", "apply", "application", "amount", "borrow", "credit", "score", "income", "salary"}
        if (
            1 <= len(words) <= 3
            and not any(w.lower() in loan_keywords for w in words)
            and all(w[0].isupper() and any(c.islower() for c in w[1:]) for w in words if w and w[0].isalpha())
            and re.fullmatch(r"^[A-Za-z][A-Za-z\-'\.]+(?:\s+[A-Za-z][A-Za-z\-'\.]+){0,2}$", message_stripped)
        ):
            extracted["full_name"] = " ".join([p[0].upper() + p[1:] if len(p) > 1 else p.upper() for p in words])

    # Income patterns
    # Support lakh/crore units as well
    unit_income = re.search(r'(\d+(?:\.\d+)?)\s*(lakh|lakhs|crore|crores)', message_lower)
    if unit_income:
        amount = float(unit_income.group(1))
        unit = unit_income.group(2)
        multiplier = 100000 if 'lakh' in unit else 10000000
        extracted["annual_income"] = int(round(amount * multiplier))
    else:
        income_match = re.search(r'income.*?(\d{4,8})|salary.*?(\d{4,8})|earn.*?(\d{4,8})', message_lower)
        if income_match:
            for group in income_match.groups():
                if group and len(group) >= 4:
                    extracted["annual_income"] = int(group)
                    break

    # Loan amount patterns
    unit_loan = re.search(r'(\d+(?:\.\d+)?)\s*(lakh|lakhs|crore|crores)', message_lower)
    if unit_loan and "loan_amount" not in extracted:
        amount = float(unit_loan.group(1))
        unit = unit_loan.group(2)
        multiplier = 100000 if 'lakh' in unit else 10000000
        extracted["loan_amount"] = int(round(amount * multiplier))
    else:
        loan_match = re.search(r'loan.*?(\d{4,8})|borrow.*?(\d{4,8})|need.*?(\d{4,8})', message_lower)
        if loan_match:
            for group in loan_match.groups():
                if group and len(group) >= 4:
                    extracted["loan_amount"] = int(group)
                    break

    # Credit score patterns
    credit_match = re.search(r'credit.*?(\d{3})|score.*?(\d{3})', message_lower)
    if credit_match:
        for group in credit_match.groups():
            if group and 300 <= int(group) <= 850:
                extracted["credit_score"] = int(group)
                break

    # Phone number
    phone_match = re.search(r'(\d{10})', message)
    if phone_match:
        extracted["phone"] = phone_match.group(1)

    # Employment status
    if "employed" in message_lower:
        extracted["employment_status"] = "employed"
    elif "self" in message_lower and "employed" in message_lower:
        extracted["employment_status"] = "self-employed"
    elif "unemployed" in message_lower:
        extracted["employment_status"] = "unemployed"

    # Dependents
    dep_match = re.search(r'(\d+)\s*(?:dependent|kid|child)', message_lower)
    if dep_match:
        extracted["num_dependents"] = int(dep_match.group(1))

    return extracted


def _has_required_fields(application) -> bool:
    """
    Check if application has all required fields for eligibility check
    """
    required_fields = [
        'annual_income', 'credit_score', 'loan_amount',
        'loan_term_months', 'num_dependents', 'employment_status'
    ]

    for field in required_fields:
        value = getattr(application, field, None)
        if value is None or (isinstance(value, (int, float)) and value == 0):
            return False

    return True


def _get_missing_fields(application) -> list:
    """
    Get list of missing required fields
    """
    required_fields = {
        'annual_income': 'annual income',
        'credit_score': 'credit score',
        'loan_amount': 'loan amount',
        'loan_term_months': 'loan term (months)',
        'num_dependents': 'number of dependents',
        'employment_status': 'employment status'
    }

    missing = []
    for field, display_name in required_fields.items():
        value = getattr(application, field, None)
        if value is None or (isinstance(value, (int, float)) and value == 0):
            missing.append(display_name)

    return missing


def _generate_suggestions(message: str, context: dict = None) -> list:
    """Generate suggested next steps based on message content and conversation context"""
    suggestions = []
    message_lower = message.lower()

    # Context-aware suggestions
    if context:
        intent = context.get("intent")
        action = context.get("action")
        missing_fields = context.get("missing_fields", [])

        if action == "collect_details" and missing_fields:
            suggestions.append(f"Provide your {missing_fields[0]}")

        if action == "predict_eligibility":
            suggestions.append("Check your loan eligibility score")

        if action == "request_document":
            suggestions.append("Upload your identity document for verification")

        if intent == "verification":
            suggestions.append("Enter the OTP code sent to your email")

    # General suggestions based on message content
    if any(word in message_lower for word in ["document", "verify", "upload"]):
        suggestions.append("Upload your identity document for verification")

    if any(word in message_lower for word in ["eligibility", "qualify", "eligible"]):
        suggestions.append("Check your loan eligibility score")

    if any(word in message_lower for word in ["interest", "rate", "term", "payment"]):
        suggestions.append("Review loan terms and calculate monthly payments")

    # Encourage proceeding to form when basics are likely captured
    if context and context.get("intent") in {"providing_info", "loan_inquiry"}:
        missing = context.get("missing_fields", [])
        if not missing:
            suggestions.insert(0, "Open detailed application form")

    if not suggestions:
        suggestions.append("Continue with the application process")

    return suggestions[:3]  # Return top 3 suggestions


def _to_structured_suggestions(suggestions: list, context: dict | None) -> list:
    """Map human-readable suggestion labels to machine-readable ids."""
    mapping = {
        "open detailed application form": "open_form",
        "check your loan eligibility score": "check_eligibility",
        "upload your identity document for verification": "upload_document",
        "enter the otp code sent to your email": "enter_otp",
        "continue with the application process": "continue",
    }
    structured = []
    for s in suggestions or []:
        label = str(s).strip()
        sid = mapping.get(label.lower())
        # For dynamic "Provide your X" suggestion
        if not sid and label.lower().startswith("provide your "):
            sid = f"provide_{label[12:].strip().replace(' ', '_')}"
        structured.append({"id": sid or "other", "label": label})
    return structured

