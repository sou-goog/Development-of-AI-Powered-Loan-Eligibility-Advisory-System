"""
Loan Prediction Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.models.database import get_db, LoanApplication
from app.models.schemas import LoanPredictionRequest, LoanPredictionResponse, LoanApplicationCreate, LoanApplicationResponse
from datetime import datetime
from app.services.ml_model_service import MLModelService
from app.utils.logger import get_logger
from app.services.report_service import ReportService
from typing import Dict, Any
from app.utils.security import decode_token
from app.models.database import User

logger = get_logger(__name__)
router = APIRouter()

ml_service = MLModelService()
def _get_current_user(request: Request, db: Session) -> User | None:
    """Extract current user from Authorization bearer token."""
    try:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return None
        token = auth_header.split(" ", 1)[1].strip()
        token_data = decode_token(token)
        if not token_data or not token_data.get("email"):
            return None
        user = db.query(User).filter(User.email == token_data["email"]).first()
        return user
    except Exception:
        return None


@router.get("/applications/last", response_model=LoanApplicationResponse)
async def get_last_application(request: Request, db: Session = Depends(get_db)):
    """Return the most recent loan application for the authenticated user."""
    user = _get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    app = (
        db.query(LoanApplication)
        .filter(LoanApplication.user_id == user.id)
        .order_by(LoanApplication.created_at.desc())
        .first()
    )
    if not app:
        raise HTTPException(status_code=404, detail="No previous application found")
    return app


@router.post("/applications")
async def create_loan_application(
    application: LoanApplicationCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new loan application
    """
    try:
        # Create new application with all required fields
        db_application = LoanApplication(
            user_id=application.user_id or 1,  # Default user for now
            full_name=application.full_name,
            email=application.email,
            phone=application.phone,
            
            # Map incoming data to model fields
            annual_income=application.annual_income,
            loan_amount=application.loan_amount,
            loan_term_months=application.loan_term_months,
            num_dependents=application.num_dependents,
            employment_status=application.employment_status,
            credit_score=application.credit_score,
            
            # Set defaults for other required fields
            age=25,  # Will be updated from form data later
            gender="Not specified",
            marital_status="Not specified", 
            monthly_income=application.annual_income / 12 if application.annual_income else 0,
            employment_type=application.employment_status or "Not specified",
            loan_amount_requested=application.loan_amount,
            loan_tenure_years=application.loan_term_months // 12 if application.loan_term_months else 1,
            region="Not specified",
            loan_purpose="Not specified",
            dependents=application.num_dependents or 0,
            existing_emi=0.0,
            salary_credit_frequency="Monthly",
            
            # OCR and calculated fields with defaults
            total_withdrawals=0.0,
            total_deposits=0.0,
            avg_balance=0.0,
            bounced_transactions=0,
            account_age_months=12,
            total_liabilities=0.0,
            debt_to_income_ratio=0.0,
            income_stability_score=0.8,
            credit_utilization_ratio=0.3,
            loan_to_value_ratio=0.7,
            
            # Status fields
            approval_status="pending",
            document_verified=False,
            created_at=datetime.utcnow()
        )
        
        db.add(db_application)
        db.commit()
        db.refresh(db_application)
        
        logger.info(f"Loan application created: {db_application.id}")
        
        return db_application
    
    except Exception as e:
        logger.error(f"Application creation error: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to create application"
        )


@router.put("/applications/{application_id}/verify-document")
async def verify_application_document(
    application_id: int,
    request: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    Update application with document verification status and extracted data
    """
    try:
        # Get application
        app = db.query(LoanApplication).filter(
            LoanApplication.id == application_id
        ).first()
        
        if not app:
            raise HTTPException(
                status_code=404,
                detail="Application not found"
            )
        # Enforce document verification rules before running prediction
        if not getattr(app, "document_verified", False):
            # Provide helpful detail about what's missing
            raw_uploaded = (app.extracted_data or {}).get("uploaded_documents") if isinstance(app.extracted_data, dict) else []
            # Normalize to ids for clarity
            uploaded_ids = []
            for it in (raw_uploaded or []):
                if isinstance(it, dict):
                    uploaded_ids.append(it.get("id"))
                else:
                    uploaded_ids.append(it)
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Required documents not uploaded",
                    "uploaded_documents": uploaded_ids or [],
                    "required": {
                        "identity": ["aadhaar", "pan", "kyc"],
                        "financial": ["bank_statement", "salary_slip"]
                    }
                }
            )
        
        # Get extracted data from request
        extracted_data = request.get("extracted_data", {})
        
        # Update document verification status
        # Merge uploaded_documents if provided and compute verification according to rules
        prev = app.extracted_data or {}
        uploaded = prev.get("uploaded_documents", []) if isinstance(prev, dict) else []
        # If request provided a document_type or uploaded_documents, merge them
        if isinstance(extracted_data, dict):
            provided_docs = extracted_data.get("uploaded_documents") or []
            if provided_docs and isinstance(provided_docs, list):
                for d in provided_docs:
                    # Normalize dicts to id when checking duplicates
                    did = d.get("id") if isinstance(d, dict) else d
                    exists = False
                    for existing in uploaded:
                        ex_id = existing.get("id") if isinstance(existing, dict) else existing
                        if ex_id == did:
                            exists = True
                            break
                    if not exists:
                        # Prefer storing the rich object if provided, else store id
                        uploaded.append(d)

        # Merge extracted_data into stored extracted_data
        merged = dict(prev or {})
        merged.update(extracted_data or {})
        merged["uploaded_documents"] = uploaded
        app.extracted_data = merged

        # Determine verification: require one identity doc and one financial doc
        identity_group = {"aadhaar", "pan", "kyc"}
        financial_group = {"bank_statement", "salary_slip"}
        # Normalize uploaded to ids for checking
        uploaded_ids = [ (x.get("id") if isinstance(x, dict) else x) for x in uploaded ]
        has_identity = any(d in identity_group for d in uploaded_ids)
        has_financial = any(d in financial_group for d in uploaded_ids)
        app.document_verified = bool(has_identity and has_financial)
        
        # Update extracted financial data if provided
        if extracted_data:
            if 'monthly_income' in extracted_data:
                app.monthly_income = float(extracted_data['monthly_income'])
                app.annual_income = app.monthly_income * 12
            if 'credit_score' in extracted_data:
                app.credit_score = int(extracted_data['credit_score'])
            if 'account_age_months' in extracted_data:
                app.account_age_months = int(extracted_data['account_age_months'])
            if 'avg_balance' in extracted_data:
                app.avg_balance = float(extracted_data['avg_balance'])
        
        db.commit()
        
        logger.info(f"Document verified for application {application_id}")
        
        return {"message": "Document verified successfully", "application_id": application_id}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document verification error: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to verify document"
        )


@router.put("/applications/{application_id}")
async def update_application(
    application_id: int,
    update_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    Update application with additional form data
    """
    try:
        # Get application
        app = db.query(LoanApplication).filter(
            LoanApplication.id == application_id
        ).first()
        
        if not app:
            raise HTTPException(
                status_code=404,
                detail="Application not found"
            )
        
        # Update fields dynamically
        for key, value in update_data.items():
            if hasattr(app, key):
                setattr(app, key, value)
        
        db.commit()
        
        logger.info(f"Application {application_id} updated with form data")
        
        return {"message": "Application updated successfully", "application_id": application_id}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Application update error: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to update application"
        )


@router.post("/predict", response_model=LoanPredictionResponse)
async def predict_eligibility(request: LoanPredictionRequest):
    """
    Predict loan eligibility based on applicant data
    
    Uses ML model to calculate eligibility score
    """
    try:
        # Prepare applicant data with all 23 features
        applicant_data = {
            # Direct input features
            "Age": request.Age,
            "Gender": request.Gender,
            "Marital_Status": request.Marital_Status,
            "Monthly_Income": request.Monthly_Income,
            "Employment_Type": request.Employment_Type,
            "Loan_Amount_Requested": request.Loan_Amount_Requested,
            "Loan_Tenure_Years": request.Loan_Tenure_Years,
            "Credit_Score": request.Credit_Score,
            "Region": request.Region,
            "Loan_Purpose": request.Loan_Purpose,
            "Dependents": request.Dependents,
            "Existing_EMI": request.Existing_EMI,
            "Salary_Credit_Frequency": request.Salary_Credit_Frequency,
            
            # OCR extracted features
            "Total_Withdrawals": request.Total_Withdrawals,
            "Total_Deposits": request.Total_Deposits,
            "Avg_Balance": request.Avg_Balance,
            "Bounced_Transactions": request.Bounced_Transactions,
            "Account_Age_Months": request.Account_Age_Months,
            
            # Calculated features
            "Total_Liabilities": request.Total_Liabilities,
            "Debt_to_Income_Ratio": request.Debt_to_Income_Ratio,
            "Income_Stability_Score": request.Income_Stability_Score,
            "Credit_Utilization_Ratio": request.Credit_Utilization_Ratio,
            "Loan_to_Value_Ratio": request.Loan_to_Value_Ratio
        }
        
        # Get prediction
        prediction = ml_service.predict_eligibility(applicant_data)
        
        logger.info(f"Loan prediction generated: {prediction['eligibility_status']}")
        
        return {
            "eligibility_score": prediction["eligibility_score"],
            "eligibility_status": prediction["eligibility_status"],
            "risk_level": prediction["risk_level"],
            "recommendations": prediction["recommendations"],
            "credit_tier": prediction["credit_tier"],
            "debt_to_income_ratio": prediction["debt_to_income_ratio"],
            "confidence": prediction["confidence"]
        }
    
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Loan prediction failed"
        )


@router.post("/predict-for-application/{application_id}")
async def predict_for_application(
    application_id: int,
    db: Session = Depends(get_db)
):
    """
    Predict eligibility for an existing application
    """
    try:
        # Get application
        app = db.query(LoanApplication).filter(
            LoanApplication.id == application_id
        ).first()
        
        if not app:
            raise HTTPException(
                status_code=404,
                detail="Application not found"
            )
        
        # Prepare data with all 23 features
        applicant_data = {
            # Direct input features
            "Age": app.age,
            "Gender": app.gender,
            "Marital_Status": app.marital_status,
            "Monthly_Income": app.monthly_income,
            "Employment_Type": app.employment_type,
            "Loan_Amount_Requested": app.loan_amount_requested,
            "Loan_Tenure_Years": app.loan_tenure_years,
            "Credit_Score": app.credit_score,
            "Region": app.region,
            "Loan_Purpose": app.loan_purpose,
            "Dependents": app.dependents,
            "Existing_EMI": app.existing_emi,
            "Salary_Credit_Frequency": app.salary_credit_frequency,
            
            # OCR extracted features
            "Total_Withdrawals": app.total_withdrawals,
            "Total_Deposits": app.total_deposits,
            "Avg_Balance": app.avg_balance,
            "Bounced_Transactions": app.bounced_transactions,
            "Account_Age_Months": app.account_age_months,
            
            # Calculated features
            "Total_Liabilities": app.total_liabilities,
            "Debt_to_Income_Ratio": app.debt_to_income_ratio,
            "Income_Stability_Score": app.income_stability_score,
            "Credit_Utilization_Ratio": app.credit_utilization_ratio,
            "Loan_to_Value_Ratio": app.loan_to_value_ratio
        }
        # Compute and persist DTI if missing/zero
        try:
            dti_cur = float(app.debt_to_income_ratio or 0)
        except Exception:
            dti_cur = 0.0
        if dti_cur == 0.0:
            monthly_income = float(app.monthly_income or 0)
            existing_emi = float(app.existing_emi or 0)
            loan_amount = float(app.loan_amount_requested or 0)
            tenure_years = float(app.loan_tenure_years or 0)
            tenure_months = int(max(round(tenure_years * 12), 0))
            monthly_rate = 0.05 / 12 if tenure_months > 0 else 0.0
            if monthly_rate > 0 and tenure_months > 0 and loan_amount > 0:
                factor = (1 + monthly_rate) ** tenure_months
                new_emi = (loan_amount * monthly_rate * factor) / (factor - 1)
            else:
                new_emi = 0.0
            total_monthly_debt = existing_emi + new_emi
            dti_ratio = (total_monthly_debt / monthly_income) if monthly_income > 0 else 0.0
            dti_ratio = float(max(0.0, min(dti_ratio, 5.0)))
            applicant_data["Debt_to_Income_Ratio"] = dti_ratio
            app.debt_to_income_ratio = dti_ratio
            db.commit()
        
        # Get prediction
        prediction = ml_service.predict_eligibility(applicant_data)
        
        # Update application
        app.eligibility_score = prediction["eligibility_score"]
        app.eligibility_status = prediction["eligibility_status"]
        db.commit()
        
        # Auto-generate report after successful prediction
        try:
            report_service = ReportService()
            app_data = {
                "id": app.id,
                "full_name": app.full_name,
                "email": app.email,
                "phone": app.phone,
                "annual_income": app.annual_income,
                "monthly_income": app.monthly_income,
                "credit_score": app.credit_score,
                "loan_amount": app.loan_amount,
                "loan_amount_requested": app.loan_amount_requested,
                "loan_term_months": app.loan_term_months,
                "num_dependents": app.num_dependents or app.dependents,
                "employment_status": app.employment_status or app.employment_type,
                "avg_balance": app.avg_balance,
                "existing_emi": app.existing_emi,
                "debt_to_income_ratio": app.debt_to_income_ratio,
                "eligibility_score": app.eligibility_score,
                "eligibility_status": app.eligibility_status,
                "approval_status": app.approval_status,
                "document_verified": app.document_verified,
                "manager_notes": app.manager_notes,
            }
            report_path = report_service.generate_report(app_data)
            app.report_path = report_path
            db.commit()
        except Exception as rep_e:
            logger.warning(f"Report generation after prediction skipped: {rep_e}")

        logger.info(f"Prediction updated for application {application_id}")
        
        return prediction
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Loan prediction failed"
        )


@router.get("/model-info")
async def get_model_info():
    """Get information about the ML model"""
    return {
        "model_type": "XGBoost",
        "version": "2.0",
        "features": [
            # Direct input features
            "Age", "Gender", "Marital_Status", "Monthly_Income", "Employment_Type",
            "Loan_Amount_Requested", "Loan_Tenure_Years", "Credit_Score", "Region",
            "Loan_Purpose", "Dependents", "Existing_EMI", "Salary_Credit_Frequency",
            # OCR extracted features
            "Total_Withdrawals", "Total_Deposits", "Avg_Balance", "Bounced_Transactions", "Account_Age_Months",
            # Calculated features
            "Total_Liabilities", "Debt_to_Income_Ratio", "Income_Stability_Score",
            "Credit_Utilization_Ratio", "Loan_to_Value_Ratio"
        ],
        "total_features": 23,
        "output_range": "0.0 - 1.0",
        "interpretation": "Higher score = higher eligibility",
        "preprocessing": "Label encoding for categorical features, Standard scaling for numerical features"
    }
