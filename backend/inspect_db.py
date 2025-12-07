from dotenv import load_dotenv
from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from app.models.database import SessionLocal, LoanApplication, User, engine
from sqlalchemy import func
import os

def inspect_db():
    print(f"Engine URL: {engine.url}")
    db = SessionLocal()
    try:
        # Check Users
        user_count = db.query(User).count()
        print(f"Total Users: {user_count}")
        users = db.query(User).all()
        for u in users:
            print(f" - ID: {u.id}, User: {u.email}, Role: {u.role}, Verified: {u.email_verified}")

        # Check Loan Applications
        app_count = db.query(LoanApplication).count()
        print(f"\nTotal Loan Applications: {app_count}")
        apps = db.query(LoanApplication).order_by(LoanApplication.created_at.desc()).limit(5).all()
        for app in apps:
            print(f" - App ID: {app.id}")
            print(f"   Name: {app.full_name}")
            print(f"   Amount: {app.loan_amount_requested}")
            print(f"   Status: {app.eligibility_status}")
            print(f"   Score: {app.eligibility_score}")
            print(f"   Report Path: {app.report_path}")
            print(f"   Extracted Data: {app.extracted_data}")
            print(f"   Document Verified: {app.document_verified}")
            print(f"   Annual Income: {app.annual_income}")
            print(f"   Monthly Income: {app.monthly_income}")
            print(f"   Credit Score: {app.credit_score}")
            print(f"   Employment Type: {app.employment_type}")
            print(f"   DTI: {app.debt_to_income_ratio}")
            print(f"   Existing EMI: {app.existing_emi}")
            print(f"   Avg Balance: {app.avg_balance}")


        # Try to insert a test user to verify write access
        try:
            test_user = User(email="db_test@example.com", full_name="DB Test", role="applicant")
            db.add(test_user)
            db.commit()
            print("\nSuccessfully inserted test user.")
            
            # Read it back
            u = db.query(User).filter_by(email="db_test@example.com").first()
            print(f"Read back test user: ID {u.id}")
            
            # Clean up
            db.delete(u)
            db.commit()
            print("Successfully deleted test user.")
        except Exception as e:
            print(f"\nFailed to write to DB: {e}")
            db.rollback()
            
    except Exception as e:
        print(f"Error inspecting DB: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    inspect_db()
