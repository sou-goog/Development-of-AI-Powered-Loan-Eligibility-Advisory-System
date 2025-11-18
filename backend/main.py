"""
AI Loan System - Main FastAPI Application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from pathlib import Path
from dotenv import load_dotenv
from contextlib import asynccontextmanager

# Load environment variables from backend/.env explicitly
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

# Import routes
from app.routes import auth_routes, chat_routes, voice_routes, ocr_routes, loan_routes, report_routes, manager_routes, otp_routes
from app.models.database import Base, engine, DB_FALLBACK_USED

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context replacing deprecated on_event startup/shutdown."""
    # Startup: ensure tables are created (works for SQLite and Postgres/Supabase)
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        # Avoid crashing the app; surface error in logs
        import logging
        logging.getLogger(__name__).error(f"DB init failed: {e}")
    yield
    # Shutdown: nothing to clean up currently

# Initialize FastAPI app with lifespan handler
app = FastAPI(
    title="AI Loan System API",
    description="Intelligent loan eligibility platform with AI chat, voice, and document verification",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files directory
static_dir = Path(__file__).parent / "app" / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Include route blueprints
app.include_router(auth_routes.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(chat_routes.router, prefix="/api/chat", tags=["Chat"])
app.include_router(voice_routes.router, prefix="/api/voice", tags=["Voice"])
app.include_router(ocr_routes.router, prefix="/api/verify", tags=["Document Verification"])
app.include_router(loan_routes.router, prefix="/api/loan", tags=["Loan Prediction"])
app.include_router(report_routes.router, prefix="/api/report", tags=["Reports"])
app.include_router(manager_routes.router, prefix="/api/manager", tags=["Manager Dashboard"])
app.include_router(otp_routes.router, prefix="/api/otp", tags=["OTP Verification"])

# Root endpoint
@app.get("/", tags=["Root"])
async def read_root():
    return {
        "message": "AI Loan System API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}

# Optional DB health for diagnostics
@app.get("/api/admin/db-health", tags=["Health"])
async def db_health():
    from sqlalchemy import text, inspect
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        return {
            "status": "ok",
            "tables": tables,
            "driver": engine.url.drivername,
            "fallback_used": DB_FALLBACK_USED,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
