"""
OCR Routes for document verification
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from sqlalchemy.orm import Session
from app.models.database import get_db, LoanApplication
from app.services.ocr_service import OCRService
from app.utils.logger import get_logger
from pathlib import Path
import tempfile

logger = get_logger(__name__)
router = APIRouter()

ocr_service = OCRService()


@router.post("/document")
async def upload_document_no_app(
    file: UploadFile = File(...),
):
    """
    Upload and verify a document WITHOUT linking to an application.

    This performs OCR quality checks and data extraction, then returns
    the extracted data without any database writes. Useful when the
    user hasn't created an application yet.
    """
    try:
        # Validate file type
        ext = Path(file.filename).suffix.lower()
        if ext not in ocr_service.supported_formats:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{ext}'. Allowed: {sorted(ocr_service.supported_formats)}"
            )
        uploads_dir = Path(__file__).parent.parent / "static" / "uploads"
        uploads_dir.mkdir(exist_ok=True, parents=True)

        file_path = uploads_dir / f"unlinked_{file.filename}"

        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)

        is_valid, quality_metrics = ocr_service.verify_document_quality(str(file_path))
        if not is_valid:
            logger.warning(f"Quality check warning (no app): {quality_metrics}")

        extracted_data = ocr_service.extract_document_data(str(file_path))

        status = "success" if is_valid else "quality_warning"
        # Flatten response for frontend convenience, keep original nested for compatibility
        flat = {
            "document_type": extracted_data.get("document_type"),
            "fields": extracted_data.get("fields", {}),
            "full_text": extracted_data.get("full_text", ""),
        }
        return {
            **flat,
            "extracted_data": extracted_data,
            "confidence_scores": {
                "overall": 0.85,
                "text_extraction": 0.90
            },
            "verification_status": status,
            "quality_metrics": quality_metrics
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document verification (no app) error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Document verification failed: {str(e)}"
        )


@router.post("/document/{application_id}")
async def verify_document(
    application_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload and verify a document for a loan application
    
    Extracts text and data using OCR (Tesseract)
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
        # Validate file type
        ext = Path(file.filename).suffix.lower()
        if ext not in ocr_service.supported_formats:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{ext}'. Allowed: {sorted(ocr_service.supported_formats)}"
            )

        # Save uploaded file
        uploads_dir = Path(__file__).parent.parent / "static" / "uploads"
        uploads_dir.mkdir(exist_ok=True, parents=True)
        
        file_path = uploads_dir / f"app_{application_id}_{file.filename}"
        
        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        # Verify document quality
        is_valid, quality_metrics = ocr_service.verify_document_quality(str(file_path))
        
        if not is_valid:
            logger.warning(f"Quality check warning for application {application_id}: {quality_metrics}")
            # Proceed with extraction but mark status as quality_warning
        
        # Extract data from document
        extracted_data = ocr_service.extract_document_data(str(file_path))

        # Map OCR fields to application ML features where possible
        try:
            doc_type = extracted_data.get("document_type")
            fields = extracted_data.get("fields", {})

            def _get_num(field_key):
                v = fields.get(field_key)
                try:
                    if isinstance(v, (list, tuple)):
                        v = v[0]
                    return float(str(v).replace(",", "")) if v is not None else None
                except Exception:
                    return None

            # Bank Statement mapping
            if doc_type == "Bank Statement":
                td = _get_num("total_debit")
                tc = _get_num("total_credit")
                ab = _get_num("average_balance") or _get_num("avg_balance")
                cb = _get_num("closing_balance")
                sca = _get_num("salary_credit_avg")
                sc_total = _get_num("salary_credit_total")
                emi_avg = _get_num("emi_avg")
                emi_total = _get_num("emi_total")

                if td is not None:
                    app.total_withdrawals = td
                if tc is not None:
                    app.total_deposits = tc
                if ab is not None:
                    app.avg_balance = ab
                # Prefer monthly average salary credit as monthly income if not present
                if (app.monthly_income is None or app.monthly_income == 0) and (sca is not None or sc_total is not None):
                    app.monthly_income = sca if sca is not None else sc_total
                    try:
                        app.annual_income = float(app.monthly_income) * 12.0
                    except Exception:
                        pass
                # Existing EMI from avg (fallback to total)
                if emi_avg is not None:
                    app.existing_emi = emi_avg
                elif emi_total is not None and (app.existing_emi is None or app.existing_emi == 0):
                    app.existing_emi = emi_total

                # Update phone if full number found and application empty
                ph = fields.get("phone")
                if ph and not app.phone:
                    app.phone = ph[0] if isinstance(ph, (list, tuple)) else ph

            # Salary Slip mapping
            if doc_type == "Salary Slip":
                net = _get_num("net_pay")
                gross = _get_num("gross_pay")
                ded = _get_num("deductions_total")
                emi_total = _get_num("emi_total")
                if net is not None:
                    app.monthly_income = net
                    try:
                        app.annual_income = float(net) * 12.0
                    except Exception:
                        pass
                if emi_total is not None:
                    app.existing_emi = emi_total
                # Optionally set salary credit frequency
                if not app.salary_credit_frequency:
                    app.salary_credit_frequency = "Monthly"
        except Exception as map_e:
            logger.warning(f"OCR->Application mapping warnings: {map_e}")

        # Update application with document info
        # Preserve previously uploaded documents in extracted_data['uploaded_documents']
        prev = app.extracted_data or {}
        uploaded = prev.get("uploaded_documents", []) if isinstance(prev, dict) else []
        # Normalize doc type ids for grouping
        doc_type = (extracted_data.get("document_type") or "").strip()
        # Map common doc_type strings to internal ids
        doc_type_map = {
            "Aadhaar": "aadhaar",
            "Aadhaar Card": "aadhaar",
            "PAN": "pan",
            "PAN Card": "pan",
            "KYC": "kyc",
            "Bank Statement": "bank_statement",
            "Salary Slip": "salary_slip",
        }
        mapped = doc_type_map.get(doc_type, doc_type.lower().replace(" ", "_") if doc_type else None)
        if mapped:
            # store rich metadata for each uploaded document (id, filename, path, uploaded_at)
            from datetime import datetime
            meta_obj = {
                "id": mapped,
                "filename": file.filename,
                "path": str(file_path),
                "uploaded_at": datetime.utcnow().isoformat() + "Z",
            }
            # Avoid duplicates by id
            if not any((isinstance(x, dict) and x.get("id") == mapped) or (isinstance(x, str) and x == mapped) for x in uploaded):
                uploaded.append(meta_obj)

        # Merge extracted data and uploaded list
        merged_extracted = dict(prev or {})
        merged_extracted.update(extracted_data or {})
        merged_extracted["uploaded_documents"] = uploaded

        app.document_path = str(file_path)
        app.extracted_data = merged_extracted

        # Determine verification: require one identity doc and one financial doc
        identity_group = {"aadhaar", "pan", "kyc"}
        financial_group = {"bank_statement", "salary_slip"}
        # Normalize uploaded entries to ids for safe membership checks
        uploaded_ids = []
        for it in uploaded:
            if isinstance(it, dict):
                uploaded_ids.append(it.get("id"))
            else:
                uploaded_ids.append(it)
        has_identity = any(d in identity_group for d in uploaded_ids if d)
        has_financial = any(d in financial_group for d in uploaded_ids if d)
        app.document_verified = bool(has_identity and has_financial)
        db.commit()
        
        # Optionally generate a report if eligibility already exists
        try:
            if getattr(app, "eligibility_score", None) is not None:
                from app.services.report_service import ReportService
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
            logger.warning(f"Report generation after verify skipped: {rep_e}")

        logger.info(f"Document processed for application {application_id}; verified={app.document_verified}")
        
        status = "success" if is_valid else "quality_warning"
        flat = {
            "document_type": merged_extracted.get("document_type"),
            "fields": merged_extracted.get("fields", {}),
            "full_text": merged_extracted.get("full_text", ""),
        }
        return {
            **flat,
            "extracted_data": merged_extracted,
            "confidence_scores": {
                "overall": 0.85,
                "text_extraction": 0.90
            },
            "verification_status": status,
            "quality_metrics": quality_metrics
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document verification error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Document verification failed: {str(e)}"
        )


@router.get("/status")
async def ocr_status():
    """Check OCR service availability"""
    try:
        # Try to detect Tesseract
        import pytesseract
        pytesseract.get_tesseract_version()
        is_available = True
    except:
        is_available = False
    
    return {
        "ocr_enabled": is_available,
        "service": "tesseract",
        "message": "Tesseract OCR is available" if is_available else "Tesseract not installed"
    }
