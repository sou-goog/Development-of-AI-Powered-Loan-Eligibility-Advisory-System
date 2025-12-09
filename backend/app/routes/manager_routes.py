# import required FastAPI modules
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models.database import get_db

# Initialize router
router = APIRouter()
# In-memory store for shared dashboard links (replace with DB for production)
shared_dashboard_links = {}
@router.post("/share-dashboard/{user_id}")
async def share_dashboard(user_id: int):
    """
    Generate a shareable link for the user's dashboard
    """
    # Generate a unique token
    token = str(uuid.uuid4())
    shared_dashboard_links[token] = user_id
    # Return the public link (adjust base URL as needed)
    link = f"http://localhost:3000/public-dashboard/{token}"
    return {"link": link, "token": token}
@router.get("/public-dashboard/{token}")
async def get_public_dashboard(token: str, db: Session = Depends(get_db)):
    """
    Return all dashboard data for the user associated with the token
    """
    user_id = shared_dashboard_links.get(token)
    if not user_id:
        raise HTTPException(status_code=404, detail="Invalid or expired dashboard link")
    # Fetch all dashboard data for the user
    # Example: get stats, applications, ML metrics, etc.
    stats = await get_application_stats(db)
    applications = await get_all_applications(db=db)
    # Dummy ML metrics (replace with real logic)
    ml_metrics = {
        "xgboost": {"accuracy": 0.92, "precision": 0.91, "recall": 0.90, "f1": 0.905},
        "decision_tree": {"accuracy": 0.85, "precision": 0.83, "recall": 0.82, "f1": 0.825},
        "random_forest": {"accuracy": 0.89, "precision": 0.88, "recall": 0.87, "f1": 0.875},
    }
    return {
        "user_id": user_id,
        "stats": stats,
        "applications": applications,
        "ml_metrics": ml_metrics,
    }
from app.services.ml_model_service import MLModelService
@router.get("/model-metrics")
async def get_model_metrics():
    """
    Return metrics for XGBoost, Decision Tree, and Random Forest models
    """
    # Dummy metrics for demonstration; replace with real model evaluation
    metrics = {
        "xgboost": {
            "accuracy": 0.92,
            "precision": 0.91,
            "recall": 0.90,
            "f1": 0.905,
            "confusionMatrix": [
                {"label": "True Positive", "value": 120},
                {"label": "True Negative", "value": 80},
                {"label": "False Positive", "value": 10},
                {"label": "False Negative", "value": 15},
            ],
        },
        "decision_tree": {
            "accuracy": 0.85,
            "precision": 0.83,
            "recall": 0.82,
            "f1": 0.825,
            "confusionMatrix": [
                {"label": "True Positive", "value": 110},
                {"label": "True Negative", "value": 70},
                {"label": "False Positive", "value": 20},
                {"label": "False Negative", "value": 25},
            ],
        },
        "random_forest": {
            "accuracy": 0.89,
            "precision": 0.88,
            "recall": 0.87,
            "f1": 0.875,
            "confusionMatrix": [
                {"label": "True Positive", "value": 115},
                {"label": "True Negative", "value": 75},
                {"label": "False Positive", "value": 15},
                {"label": "False Negative", "value": 20},
            ],
        },
    }
    return metrics
"""
Manager Dashboard Routes
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.models.database import get_db, LoanApplication, User
from app.models.schemas import ManagerApplicationResponse, ManagerDecisionRequest, ApplicationStats
from app.services.email_service import email_service
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.get("/stats", response_model=ApplicationStats)
async def get_application_stats(db: Session = Depends(get_db)):
    """
    Get statistics about all loan applications
    
    Requires manager role
    """
    try:
        total = db.query(LoanApplication).count()
        pending = db.query(LoanApplication).filter(
            LoanApplication.approval_status == "pending"
        ).count()
        approved = db.query(LoanApplication).filter(
            LoanApplication.approval_status == "approved"
        ).count()
        rejected = db.query(LoanApplication).filter(
            LoanApplication.approval_status == "rejected"
        ).count()
        
        logger.info("Application stats retrieved")
        
        return {
            "total_applications": total,
            "pending_applications": pending,
            "approved_applications": approved,
            "rejected_applications": rejected
        }
    
    except Exception as e:
        logger.error(f"Error getting stats: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve statistics"
        )


@router.get("/applications", response_model=list[ManagerApplicationResponse])
async def get_all_applications(
    status_filter: str = None,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Get all loan applications with optional filtering
    
    Query parameters:
    - status_filter: pending, approved, rejected
    - skip: pagination offset
    - limit: number of results
    """
    try:
        from sqlalchemy import desc
        from sqlalchemy import and_
        query = db.query(LoanApplication).order_by(desc(LoanApplication.created_at))

        # Only show applications that have completed the applicant flow:
        # - document verified
        # - eligibility score present
        query = query.filter(
            and_(
                LoanApplication.document_verified == True,
                LoanApplication.eligibility_score.isnot(None),
            )
        )
        
        if status_filter:
            query = query.filter(LoanApplication.approval_status == status_filter)
        
        applications = query.offset(skip).limit(limit).all()
        
        logger.info(f"Retrieved {len(applications)} applications")
        
        return applications
    
    except Exception as e:
        logger.error(f"Error getting applications: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve applications"
        )


@router.get("/applications/{application_id}")
async def get_application_details(
    application_id: int,
    db: Session = Depends(get_db)
):
    """
    Get detailed information about a specific application
    """
    try:
        app = db.query(LoanApplication).filter(
            LoanApplication.id == application_id
        ).first()
        
        if not app:
            raise HTTPException(
                status_code=404,
                detail="Application not found"
            )
        
        return {
            "id": app.id,
            "user_id": app.user_id,
            "full_name": app.full_name,
            "email": app.email,
            "phone": app.phone,
            "age": app.age,
            "gender": app.gender,
            "marital_status": app.marital_status,
            "monthly_income": app.monthly_income,
            "employment_type": app.employment_type,
            "loan_amount_requested": app.loan_amount_requested,
            "loan_tenure_years": app.loan_tenure_years,
            "credit_score": app.credit_score,
            "region": app.region,
            "loan_purpose": app.loan_purpose,
            "dependents": app.dependents,
            "existing_emi": app.existing_emi,
            "salary_credit_frequency": app.salary_credit_frequency,
            "total_withdrawals": app.total_withdrawals,
            "total_deposits": app.total_deposits,
            "avg_balance": app.avg_balance,
            "bounced_transactions": app.bounced_transactions,
            "account_age_months": app.account_age_months,
            "total_liabilities": app.total_liabilities,
            "annual_income": app.annual_income,
            "loan_amount": app.loan_amount,
            "loan_term_months": app.loan_term_months,
            "num_dependents": app.num_dependents,
            "employment_status": app.employment_status,
            "eligibility_score": app.eligibility_score,
            "eligibility_status": app.eligibility_status,
            "approval_status": app.approval_status,
            "document_verified": app.document_verified,
            "extracted_data": app.extracted_data,
            "manager_notes": app.manager_notes,
            "created_at": app.created_at,
            "updated_at": app.updated_at
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting application details: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve application details"
        )


@router.post("/applications/{application_id}/decision")
async def make_decision(
    application_id: int,
    decision: ManagerDecisionRequest,
    db: Session = Depends(get_db)
):
    """
    Manager makes a decision (approve/reject) on an application
    """
    try:
        app = db.query(LoanApplication).filter(
            LoanApplication.id == application_id
        ).first()
        
        if not app:
            raise HTTPException(
                status_code=404,
                detail="Application not found"
            )
        
        # Validate decision
        if decision.decision.lower() not in ["approved", "rejected"]:
            raise HTTPException(
                status_code=400,
                detail="Decision must be 'approved' or 'rejected'"
            )
        
        # Update application
        app.approval_status = decision.decision.lower()
        if decision.notes:
            app.manager_notes = decision.notes
        
        db.commit()
        
        # Send notification email to applicant
        email_service.send_manager_decision_notification(
            app.email,
            app.full_name,
            decision.decision.lower(),
            decision.notes
        )
        
        logger.info(f"Manager decision made for application {application_id}: {decision.decision}")
        
        return {
            "success": True,
            "application_id": application_id,
            "approval_status": app.approval_status,
            "message": f"Application {decision.decision}",
            "notification_sent": True
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error making decision: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to make decision"
        )
