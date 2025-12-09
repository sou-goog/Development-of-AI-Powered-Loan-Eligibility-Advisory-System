
import sys
import os
import logging

# Add backend to path
sys.path.append(os.path.abspath("c:/Users/asus/Project/intern/backend"))

from app.services.ml_model_service import MLModelService

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_prediction():
    print("--- Initializing ML Service ---")
    service = MLModelService()
    
    if service.model is None:
        print("ERROR: Model failed to load (is None)")
    else:
        print(f"SUCCESS: Model loaded. Type: {type(service.model)}")
        if hasattr(service, 'x_columns') and service.x_columns:
            print(f"X_Columns loaded: {len(service.x_columns)} items")
        else:
            print("WARNING: X_Columns missing")

    print("\n--- Running Prediction Test ---")
    # Data structure exactly as sent from voice_realtime_v2.py
    applicant = {
        "Monthly_Income": 5000.0,
        "Credit_Score": 750,
        "Loan_Amount_Requested": 10000.0,
        "Loan_Tenure_Years": 5, 
        "Existing_EMI": 0,
    }
    
    try:
        result = service.predict_eligibility(applicant)
        print("\n--- Result ---")
        print(result)
    except Exception as e:
        print(f"\nCRITICAL ERROR during prediction: {e}")

if __name__ == "__main__":
    test_prediction()
