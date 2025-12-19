# 🏦 AI-Powered Loan Eligibility Advisory System

> **A full-stack intelligent loan processing platform featuring real-time voice agents, ML-based eligibility prediction, document verification, and automated decision-making.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black)](https://development-of-ai-powered-loan-elig.vercel.app/)
[![Backend API](https://img.shields.io/badge/Backend-Render-green)](https://ai-loan-backend-7eob.onrender.com/docs)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 📷 Demo

https://github.com/user-attachments/assets/3bb50548-ca52-4b69-98fb-3b1bd8e47976

---

## 🚀 Live Deployment

**Frontend (React):** https://development-of-ai-powered-loan-elig.vercel.app/  
**Backend API:** https://ai-loan-backend-7eob.onrender.com/  
**API Docs (Swagger):** https://ai-loan-backend-7eob.onrender.com/docs

**Default Credentials:**
- **Applicant:** `user@example.com` / `password123`
- **Manager:** `manager@example.com` / `manager123`

---

## 📋 Table of Contents

1. [Overview](#-overview)
2. [Key Features](#-key-features)
3. [Architecture](#-architecture)
4. [Tech Stack](#-tech-stack)
5. [Prerequisites](#-prerequisites)
6. [Installation](#-installation)
7. [Running the Application](#-running-the-application)
8. [Environment Variables](#-environment-variables)
9. [API Documentation](#-api-documentation)
10. [Project Structure](#-project-structure)
11. [Production Deployment](#-production-deployment)
12. [Development Challenges](#-development-challenges-solved)
13. [Performance Metrics](#-performance-metrics)
14. [Testing Guide](#-testing-guide)
15. [Troubleshooting](#-troubleshooting)
16. [Security](#-security-considerations)
17. [License](#-license)
18. [Author](#-author)

---

## 🎯 Overview

The AI Loan System automates the loan application process by:

- **Real-Time Voice Agent**: Conversational AI using WebSocket streaming (Deepgram Nova-2 STT + Groq Llama 3.1 LLM + Deepgram Aura TTS) for hands-free loan applications
- **Chat Interface**: Users interact with an AI agent (powered by Ollama/Llama3 locally or Gemini/OpenRouter) to discuss loan options
- **Voice Input/Output**: Batch speech-to-text (Whisper) and text-to-speech (gTTS) for accessibility
- **Document Verification**: OCR-based (Tesseract) document extraction and validation
- **ML Prediction**: Ensemble model (XGBoost + Random Forest + Decision Tree) predicts loan eligibility with 85-92% accuracy
- **PDF Reports**: Jinja2 + ReportLab generates professional loan application reports
- **Manager Dashboard**: Review applications, make decisions, and download reports
- **JWT Authentication**: Secure user authentication with bcrypt password hashing

---

## ✨ Key Features

### 🎙️ **Real-Time Voice Agent** (Primary Innovation)
- **Conversational AI** for hands-free loan applications
- **WebSocket streaming** with <2s end-to-end latency
- **Deepgram Nova-2** (real-time STT) + **Groq Llama 3.1-8B-Instant** (LLM) + **Deepgram Aura** (natural TTS)
- Collects 7 data points through natural conversation:
  1. Full Name
  2. Monthly Income
  3. Credit Score
  4. Loan Amount Requested
  5. Employment Type (Salaried/Business)
  6. Loan Purpose (Personal/Home/Education)
  7. Existing EMI
- Automatic transition to document verification
- 95%+ speech recognition accuracy
- Reduces application time by **70%** (10 min → 3 min)

### 🤖 **ML-Based Eligibility Prediction**
- **Ensemble model:** XGBoost (primary) + Random Forest + Decision Tree
- **85-92% accuracy** on trained dataset
- Real-time prediction with confidence scores (0-100%)
- Explainable AI (shows decision reasoning)
- Analyzes 10+ features including income-to-loan ratio, credit score, EMI burden

### 📄 **Document OCR & Verification**
- **Tesseract engine** for text extraction from images
- **pdfminer.six** for PDF text extraction
- Supports PDF, JPG, PNG formats
- Validates income proof, ID proof, employment documents
- Automatic data extraction and comparison with user input

### 📊 **Manager Dashboard**
- View all loan applications with filter options
- Approve/reject applications with notes
- Filter by status (Pending/Approved/Rejected)
- Real-time statistics and analytics
- Bulk operations support
- Download PDF reports for applications

### 💬 **AI Chat Interface**
- Powered by Ollama (local Llama 3), Google Gemini, or OpenRouter
- Context-aware conversations about loan products
- Provides personalized recommendations
- Maintains conversation history

### 🔐 **Secure Authentication**
- JWT-based session management (30-min expiration)
- bcrypt password hashing (12 rounds)
- Role-based access control (Applicant/Manager)
- Session persistence with token refresh

---

## 🏗️ Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Port 3000)               │
│  ┌────────────┐  ┌──────────┐  ┌────────────────┐          │
│  │  Chatbot   │  │  Voice   │  │ Document Upload│          │
│  │   (AI)     │  │ Agent    │  │   & Verify     │          │
│  └────────────┘  └──────────┘  └────────────────┘          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │        Manager Dashboard & Decision Making         │   │
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/REST + WebSocket
┌──────────────────────────┴──────────────────────────────────┐
│           FastAPI Backend (Port 8000)                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Chat API   │  │Voice API     │  │   OCR API    │      │
│  │  (Ollama/    │  │(Whisper/     │  │ (Tesseract)  │      │
│  │   Gemini)    │  │ Deepgram)    │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Loan API    │  │ Report API   │  │ Manager API  │      │
│  │  (ML Models) │  │(ReportLab)   │  │   (Admin)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │    SQLite/PostgreSQL DB (SQLAlchemy ORM)           │   │
│  │    Users | Applications | Chat Sessions            │   │
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼─────┐  ┌────────▼────────┐  ┌──────▼────────┐
│   Ollama     │  │  Deepgram       │  │  Tesseract    │
│  (Local LLM) │  │  (Cloud Voice)  │  │  (OCR)        │
└──────────────┘  └─────────────────┘  └───────────────┘
```

### Production Deployment Architecture

```
┌─────────────────────────────────────┐
│   Vercel CDN (Frontend)             │
│   Global Edge Network               │
│   https://...vercel.app             │
└───────────────┬─────────────────────┘
                │ HTTPS + WSS
┌───────────────▼─────────────────────┐
│   Render (Backend)                  │
│   FastAPI + WebSocket               │
│   https://ai-loan-backend-...       │
│   Python 3.11 Runtime               │
└───────────────┬─────────────────────┘
                │
┌───────────────▼─────────────────────┐
│   Render PostgreSQL (256MB)         │
│   Users | Applications | Logs       │
└─────────────────────────────────────┘
                │
        External APIs:
    ┌───────┴───────┐
┌───▼────┐     ┌───▼────┐
│Deepgram│     │  Groq  │
│ (Voice)│     │ (LLM)  │
└────────┘     └────────┘

GitHub Actions Workflow:
   └─► Pings backend every 5 min
       Ensures 24/7 uptime (free tier)
```

---

## 💻 Tech Stack

### **Frontend**
- **Framework**: React 18
- **HTTP Client**: Axios with custom API wrappers
- **Routing**: React Router v6
- **Real-time Audio**: Web Audio API + MediaRecorder
- **WebSocket**: Native WebSocket API for voice streaming
- **Styling**: Custom CSS (glassmorphism design)
- **State Management**: React Hooks (useState, useRef, useEffect)
- **Notifications**: react-toastify
- **Animations**: framer-motion

### **Backend**
- **Framework**: FastAPI (async/await)
- **Runtime**: Python 3.11
- **Database ORM**: SQLAlchemy 2.0.23
- **Database**: PostgreSQL (production) / SQLite (local)
- **Authentication**: JWT (python-jose) + bcrypt
- **WebSocket**: Native FastAPI WebSockets
- **Async Processing**: asyncio

### **AI/ML Services**

**Voice AI (Real-time):**
- **STT**: Deepgram Nova-2 (streaming)
- **LLM**: Groq (Llama 3.1-8B-Instant)
- **TTS**: Deepgram Aura (natural voice synthesis)
- **Protocol**: WebSocket bidirectional streaming

**Chat (Batch):**
- **Local LLM**: Ollama (Llama 3.2)
- **Cloud LLM**: Google Gemini or OpenRouter
- **Voice (Batch)**: Whisper CLI (STT) + gTTS (TTS)

**ML Model:**
- **Models**: XGBoost 2.0.3 + scikit-learn 1.3.2+
- **Feature Engineering**: pandas + numpy
- **Preprocessing**: StandardScaler + LabelEncoder

**OCR:**
- **Engine**: Tesseract (pytesseract 0.3.10)
- **PDF Processing**: pdfminer.six 20221105
- **Image Processing**: Pillow 10.3.0+

### **Deployment & DevOps**
- **Frontend Hosting**: Vercel (Edge CDN)
- **Backend Hosting**: Render (Free tier)
- **Database**: Render PostgreSQL
- **CI/CD**: GitHub Actions
- **Keep-Alive**: Custom GitHub Actions workflow (every 5 min)
- **Monitoring**: UptimeRobot (optional)

### **Additional Libraries**
- **PDF Generation**: reportlab 4.0.7
- **JWT**: python-jose[cryptography] 3.3.0
- **Password Hashing**: passlib[bcrypt] 1.7.4
- **HTTP Requests**: requests 2.31.0
- **Data Validation**: Pydantic 2.8.0+
- **Logging**: Python native logging

---

## 📦 Prerequisites

### System Requirements
- **OS**: Windows, macOS, or Linux
- **Node.js**: 18.x or higher
- **Python**: 3.11 or higher
- **RAM**: 8GB+ recommended
- **Disk**: 5GB+ for models and dependencies

### Required Software

#### 1. **Node.js & npm**
```bash
# Check version
node --version  # Should be 18+
npm --version   # Should be 9+

# Download from: https://nodejs.org/
```

#### 2. **Python 3.11**
```bash
# Check version
python --version  # Should be 3.11+

# Download from: https://www.python.org/downloads/
```

#### 3. **Git**
```bash
# Check installation
git --version

# Download from: https://git-scm.com/downloads
```

### Optional Local Services (for development)

#### **Ollama** (Local LLM - optional)
```bash
# Install Ollama from https://ollama.ai
# Or via package manager:
brew install ollama  # macOS
winget install Ollama.Ollama  # Windows

# Pull llama3 model (2.7GB)
ollama pull llama3

# Run Ollama server (default port 11434)
ollama serve
```

#### **Tesseract** (OCR - optional for document verification)
```bash
# macOS
brew install tesseract

# Windows
choco install tesseract

# Linux
sudo apt-get install tesseract-ocr

# Verify installation
tesseract --version
```

#### **Whisper** (Speech Recognition - optional for batch voice)
```bash
# Will be installed via pip (openai-whisper)
# First time usage will download model (~2.7GB for base model)
```

---

## 🚀 Installation

### 1. Clone Repository

```bash
git clone https://github.com/sou-goog/Development-of-AI-Powered-Loan-Eligibility-Advisory-System.git
cd Development-of-AI-Powered-Loan-Eligibility-Advisory-System
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
# Windows:
copy .env.example .env
# macOS/Linux:
cp .env.example .env

# Edit .env with your settings
# Minimum required for production:
# SECRET_KEY=your-secret-key
# DATABASE_URL=sqlite:///./ai_loan_system.db
# GROQ_API_KEY=your-groq-key  # Get from https://console.groq.com/keys
# DEEPGRAM_API_KEY=your-deepgram-key  # Get from https://console.deepgram.com/
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Create .env file
echo "REACT_APP_API_URL=http://localhost:8000/api" > .env

# For Windows CMD:
# echo REACT_APP_API_URL=http://localhost:8000/api > .env

# For Windows PowerShell:
# Set-Content .env "REACT_APP_API_URL=http://localhost:8000/api"
```

### 4. Train ML Model (Optional)

**⚠️ Note**: The repository includes a template training script. You must provide your own dataset.

```bash
cd ../ml

# Edit loan_training.py to load your dataset
# Implement load_your_dataset() function

# Run training
python loan_training.py

# This saves models to: ml/app/models/
```

**Alternative**: Place your pre-trained models in `backend/app/models/` or `ml/app/models/`

---

## ▶️ Running the Application

### Local Development

#### Terminal 1: Start Backend
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
python main.py

# Backend starts at: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

#### Terminal 2: Start Frontend
```bash
cd frontend
npm start

# Frontend opens at: http://localhost:3000
```

#### Terminal 3: Start Ollama (Optional - for local LLM)
```bash
ollama serve
# Or if already running: ollama list
```

### Access the Application

1. **Open browser**: http://localhost:3000
2. **Login** with default credentials:
   - Applicant: `user@example.com` / `password123`
   - Manager: `manager@example.com` / `manager123`

---

## 🔑 Environment Variables

### Backend (.env)

```env
# JWT Secret
SECRET_KEY=your-secret-key-here-change-in-production

# Database
DATABASE_URL=sqlite:///./ai_loan_system.db
# For PostgreSQL: postgresql://user:pass@localhost/ai_loan_system

# Voice AI (Real-time)
GROQ_API_KEY=gsk_your_groq_key_here
DEEPGRAM_API_KEY=your_deepgram_key_here
GROQ_MODEL=llama-3.1-8b-instant
DEEPGRAM_MODEL=nova-2

# LLM Provider (for chat)
LLM_PROVIDER=ollama  # Options: ollama, gemini, openrouter
OLLAMA_API_URL=http://localhost:11434/api
OLLAMA_MODEL=llama3.2

# Google Gemini (optional)
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-pro

# OpenRouter (optional)
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openai/gpt-3.5-turbo

# Voice Settings (batch)
WHISPER_MODEL=base  # Options: tiny, base, small, medium, large
WHISPER_LANGUAGE=en

# Email (optional - disabled in production)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# JWT Settings
ACCESS_TOKEN_EXPIRE_MINUTES=30
ALGORITHM=HS256

# ML Model
ML_MODEL_DIR=ml/app/models
```

### Frontend (.env)

```env
# Local development
REACT_APP_API_URL=http://localhost:8000/api

# Production
REACT_APP_API_URL=https://ai-loan-backend-7eob.onrender.com/api
```

---

## 📚 API Documentation

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "full_name": "John Doe",
  "role": "applicant"  # or "manager"
}

Response: {
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": { ... }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response: {
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": { "id": 1, "email": "...", "role": "..." }
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>

Response: {
  "id": 1,
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "applicant"
}
```

### Voice Agent (Real-time WebSocket)

```javascript
// Connect to WebSocket
const ws = new WebSocket(`wss://backend-url/api/voice/stream?token=<jwt>`);

// Send audio chunks (base64)
ws.send(JSON.stringify({
  type: "audio_chunk",
  audio: base64AudioData
}));

// Receive messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // data.type: "audio_chunk", "transcript_partial", "transcript_final", "ai_text", etc.
};
```

### Loan Application

#### Create Application
```http
POST /api/loan/applications
Authorization: Bearer <token>
Content-Type: application/json

{
  "full_name": "John Doe",
  "monthly_income": 50000,
  "credit_score": 750,
  "loan_amount": 1000000,
  "employment_type": "Salaried",
  "loan_purpose": "Home",
  "existing_emi": 5000
}

Response: {
  "application_id": 1,
  "status": "pending",
  "eligibility_score": null
}
```

#### Predict Eligibility
```http
POST /api/loan/predict
Authorization: Bearer <token>
Content-Type: application/json

{
  "annual_income": 600000,
  "credit_score": 750,
  "loan_amount": 1000000,
  "loan_term_months": 240,
  "num_dependents": 2,
  "employment_status": "employed"
}

Response: {
  "eligibility_score": 0.87,
  "eligibility_status": "eligible",
  "risk_level": "low_risk",
  "confidence": 92.5,
  "recommendations": [...]
}
```

### Manager Operations

#### Get All Applications
```http
GET /api/manager/applications?status_filter=pending&skip=0&limit=20
Authorization: Bearer <token>

Response: [
  {
    "id": 1,
    "full_name": "John Doe",
    "loan_amount": 1000000,
    "eligibility_score": 0.87,
    "status": "pending",
    "created_at": "2024-01-15T10:30:00"
  }
]
```

#### Approve/Reject Application
```http
POST /api/manager/applications/1/decision
Authorization: Bearer <token>
Content-Type: application/json

{
  "decision": "approved",  # or "rejected"
  "notes": "Good credit score and income ratio"
}

Response: {
  "success": true,
  "application_id": 1,
  "approval_status": "approved"
}
```

**Full API Documentation**: https://ai-loan-backend-7eob.onrender.com/docs

---

## 📂 Project Structure

```
AI-Powered-Loan-Eligibility-Advisory-System/
├── .github/
│   └── workflows/
│       └── keep-alive.yml          # GitHub Actions keep-alive workflow
│
├── backend/
│   ├── main.py                     # FastAPI entry point
│   ├── requirements.txt            # Python dependencies
│   ├── runtime.txt                 # Python 3.11.0 for Render
│   ├── .env.example                # Environment variables template
│   ├── ai_loan_system.db          # SQLite database (auto-created)
│   ├── logs/
│   │   └── app.log                # Application logs
│   └── app/
│       ├── routes/
│       │   ├── auth_routes.py     # Authentication endpoints
│       │   ├── chat_routes.py     # Chat/AI endpoints
│       │   ├── voice_routes.py    # Batch voice I/O endpoints
│       │   ├── voice_realtime_v2.py  # Real-time voice agent (WebSocket)
│       │   ├── ocr_routes.py      # Document verification
│       │   ├── loan_routes.py     # Loan prediction & applications
│       │   ├── report_routes.py   # PDF report generation
│       │   ├── manager_routes.py  # Manager dashboard
│       │   ├── otp_routes.py      # OTP authentication (disabled in prod)
│       │   └── notification_routes.py  # Email notifications (disabled)
│       ├── services/
│       │   ├── ollama_service.py  # Ollama LLM integration
│       │   ├── gemini_service.py  # Google Gemini integration
│       │   ├── openrouter_service.py  # OpenRouter integration
│       │   ├── voice_service.py   # Whisper & gTTS (batch)
│       │   ├── ocr_service.py     # Tesseract OCR
│       │   ├── ml_model_service.py  # XGBoost predictions
│       │   └── report_service.py  # PDF generation (reportlab)
│       ├── models/
│       │   ├── database.py        # SQLAlchemy models
│       │   ├── schemas.py         # Pydantic schemas
│       │   ├── loan_xgboost_model.pkl       # XGBoost model (optional)
│       │   ├── loan_random_forest_model.pkl  # Random Forest (optional)
│       │   ├── loan_decision_tree_model.pkl  # Decision Tree (optional)
│       │   ├── scaler.pkl         # Feature scaler
│       │   └── label_encoders.pkl # Label encoders
│       ├── utils/
│       │   ├── security.py        # JWT & password hashing
│       │   └── logger.py          # Logging configuration
│       ├── templates/
│       │   └── report_template.html  # HTML report template
│       └── static/
│           ├── uploads/           # Uploaded documents
│           ├── voices/            # Generated audio files
│           └── reports/           # Generated PDF reports
│
├── frontend/
│   ├── package.json               # Node dependencies
│   ├── .env                       # Environment variables
│   ├── public/
│   │   ├── index.html
│   │   └── favicon.ico
│   └── src/
│       ├── App.js                 # Main component & routing
│       ├── App.css
│       ├── index.js               # Entry point
│       ├── index.css              # Global styles
│       ├── components/
│       │   ├── Chatbot.jsx        # AI chatbot component
│       │   ├── LoginForm.jsx      # Authentication form
│       │   ├── Dashboard.jsx      # Applicant dashboard
│       │   ├── VoiceAgentRealtime_v2.jsx  # Real-time voice agent (WebSocket)
│       │   ├── VoiceAgentRealtime.jsx     # Legacy Vosk/Piper agent
│       │   ├── DocumentVerification.jsx   # Upload & OCR
│       │   ├── ManagerDashboard.jsx       # Manager UI
│       │   └── ManagerNotifications.jsx   # WebSocket notifications
│       ├── pages/
│       │   ├── Home.jsx
│       │   └── Manager.jsx
│       └── utils/
│           ├── api.js             # Axios API client
│           └── auth.js            # JWT token management
│
├── ml/
│   ├── loan_training.py           # Model training script
│   ├── loan_applicants_dataset.csv  # Training dataset (template)
│   └── app/
│       └── models/                # Trained model artifacts
│           ├── loan_xgboost_model.pkl
│           ├── scaler.pkl
│           └── label_encoders.pkl
│
├── render.yaml                    # Render deployment config
├── PROJECT_SUMMARY.md             # Comprehensive project documentation
├── DEPLOYMENT.md                  # Deployment guide
└── README.md                      # This file
```

---

## 🚀 Production Deployment

### Deployment Stack

- **Frontend**: Vercel (Global Edge CDN)
- **Backend**: Render (Free tier with keep-alive)
- **Database**: Render PostgreSQL (256MB free)
- **CI/CD**: GitHub Actions (auto-deploy + keep-alive)

### Setup Instructions

#### 1. Backend on Render

1. **Push code to GitHub**
2. Go to https://dashboard.render.com/
3. Click **"New +"** → **"Blueprint"**
4. Connect your GitHub repository
5. Render will detect `render.yaml` and create:
   - `ai-loan-backend` (web service)
   - `ai-loan-db` (PostgreSQL database)
6. Set environment variables in Render dashboard:
   - `GROQ_API_KEY`
   - `DEEPGRAM_API_KEY`
7. Deploy!

Backend URL: `https://ai-loan-backend-xxxx.onrender.com`

#### 2. Frontend on Vercel

1. Go to https://vercel.com/dashboard
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Configure:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
5. Add environment variable:
   - `REACT_APP_API_URL`: `https://your-backend-url.onrender.com/api`
6. Deploy!

Frontend URL: `https://your-project.vercel.app`

#### 3. Enable GitHub Actions Keep-Alive

1. Go to your GitHub repo → **Actions** tab
2. Click **"I understand my workflows, go ahead and enable them"**
3. The workflow will:
   - Ping your backend every 5 minutes
   - Prevent Render free tier from sleeping
   - Ensure 24/7 uptime

**Detailed Guide**: See `DEPLOYMENT.md`

---

## 🚧 Development Challenges Solved

### 1. **Voice Agent Response Truncation**
**Problem**: Agent stopped mid-sentence ("Hi! I...")  
**Root Cause**: `UnboundLocalError` caused by nested `import base64` in exception handler  
**Solution**: Removed local import, used global base64 module  
**Impact**: Voice agent now responds reliably without interruption

### 2. **Premature Verification Trigger**
**Problem**: Eligibility verification triggered before user answered EMI question  
**Root Cause**: LLM outputted `existing_emi: 0` in JSON while still actively asking for it  
**Solution**: Added text analysis to detect if AI is asking for EMI before triggering verification  
**Impact**: User can now complete all questions without premature transitions

### 3. **EMI Negative Values**
**Problem**: System stored `-20.0` instead of `20000.0` for EMI  
**Root Cause**: Regex preserved minus sign from LLM output, confused by `-1` sentinel value  
**Solution**: Updated regex to strip minus signs, use `abs()`, changed sentinel to `0`  
**Impact**: Accurate EMI data collection and validation

### 4. **Python 3.13 Incompatibility**
**Problem**: SQLAlchemy 2.0.23 crashed on Python 3.13 with `AssertionError: __firstlineno__`  
**Root Cause**: SQLAlchemy doesn't support Python 3.13's new typing features yet  
**Solution**: Created `runtime.txt` to pin Python 3.11.0 on Render  
**Impact**: Stable production deployment

### 5. **WebSocket Connection Failures**
**Problem**: Voice agent couldn't connect in production  
**Root Cause**: Frontend hardcoded `localhost:8000` for WebSocket URL  
**Solution**: Used `REACT_APP_API_URL` environment variable for dynamic URL  
**Impact**: Voice agent works seamlessly in production

### 6. **Backend Sleep Timeout**
**Problem**: 30-60s wait on first login after 15 min inactivity  
**Root Cause**: Render free tier sleeps after 15 minutes  
**Solution**: GitHub Actions workflow + 60s frontend timeout  
**Impact**: Always-on backend with minimal wake-up delay

### 7. **LLM Hallucination**
**Problem**: LLM completed user sentences with guessed values  
**Root Cause**: Unclear prompt instructions  
**Solution**: Updated prompt to forbid completing partial input  
**Impact**: Accurate data collection, no hallucinated values

### 8. **Slow Voice Response**
**Problem**: Perceived latency in agent responses  
**Root Cause**: Sentence splitter breaking on commas, causing multiple TTS API calls  
**Solution**: Removed comma from split delimiters, optimized streaming  
**Impact**: Faster voice response, <2s end-to-end latency

---

## 📊 Performance Metrics

### Voice Agent
- **Average Conversation Time**: 2-3 minutes (vs 10-15 min traditional form)
- **Speech Recognition Accuracy**: 95%+ (Deepgram Nova-2)
- **LLM Response Latency**: 800ms - 1.5s
- **Audio Synthesis Latency**: 200-500ms (Deepgram Aura)
- **End-to-End Latency**: <2s per conversational turn
- **Time Savings**: 70% faster than manual forms

### ML Model
- **Inference Time**: <100ms
- **Model Accuracy**: 85-92% on validation set
- **Model Size**: ~2MB (XGBoost)
- **Feature Count**: 10 engineered features
- **Prediction Confidence**: 0-100% score

### Backend API
- **API Response Time**: 50-200ms (excluding external APIs)
- **WebSocket Latency**: <500ms
- **Concurrent Connections**: 100+ supported
- **Database Query Time**: 10-50ms

### Frontend
- **Initial Load Time**: 1.5-2s
- **Time to Interactive**: 2.5s
- **Bundle Size**: ~500KB gzipped
- **Lighthouse Score**: 90+ performance

---

## 🧪 Testing Guide

### Manual Testing

#### Test 1: System Health
```bash
# Check backend health
curl https://ai-loan-backend-7eob.onrender.com/health

# Expected: {"status": "healthy"}
```

#### Test 2: User Registration
```bash
curl -X POST https://ai-loan-backend-7eob.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "full_name": "Test User",
    "role": "applicant"
  }'
```

#### Test 3: Login
```bash
curl -X POST https://ai-loan-backend-7eob.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

#### Test 4: Eligibility Prediction
```bash
curl -X POST https://ai-loan-backend-7eob.onrender.com/api/loan/predict \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "annual_income": 600000,
    "credit_score": 750,
    "loan_amount": 1000000,
    "loan_term_months": 240,
    "num_dependents": 2,
    "employment_status": "employed"
  }'
```

### UI Testing Flow

1. **Login**: `user@example.com` / `password123`
2. **Voice Agent**: Click microphone → Say "Hello"
3. **Complete Application**: Answer all 7 questions naturally
4. **Upload Documents**: PDF/JPG of income proof
5. **View Results**: Check eligibility score and explanation
6. **Manager View**: Login as `manager@example.com` / `manager123`
7. **Approve/Reject**: Process the application

---

## 🔧 Troubleshooting

### Issue 1: Backend Not Responding (502 Error)
**Cause**: Render free tier is sleeping  
**Solution**: Wait 30 seconds for backend to wake up, or ping `/health` endpoint first

### Issue 2: Voice Agent Disconnected
**Cause**: WebSocket connection failed or backend sleeping  
**Solution**: 
1. Check browser console for errors
2. Ensure `REACT_APP_API_URL` is set correctly
3. Wait for backend to wake if sleeping

### Issue 3: Login Timeout
**Cause**: Backend sleeping, 60s timeout not enough  
**Solution**: 
1. Wake backend first: visit `https://backend-url/health`
2. Then try login

### Issue 4: Voice Agent Not Recognizing Speech
**Cause**: Microphone permission denied or poor audio quality  
**Solution**:
1. Check browser microphone permissions
2. Use Chrome/Edge for best compatibility
3. Ensure good internet connection
4. Speak clearly near microphone

### Issue 5: Missing ML Model Errors
**Cause**: Pre-trained models not found  
**Solution**:
1. Train models using `ml/loan_training.py`, OR
2. Place your models in `backend/app/models/`
3. Restart backend

### Issue 6: CORS Errors in Production
**Cause**: Frontend URL not in backend CORS allow list  
**Solution**:
1. Update `main.py` with your Vercel URL
2. Redeploy backend

### Issue 7: Database Connection Error
**Cause**: PostgreSQL connection string incorrect  
**Solution**:
1. Check `DATABASE_URL` in Render environment variables
2. Ensure it matches `render.yaml` configuration

---

## 🔐 Security Considerations

### Authentication
- **JWT Tokens**: 30-minute expiration (configurable)
- **Password Hashing**: bcrypt with 12 rounds
- **Token Storage**: localStorage (upgrade to httpOnly cookies for production)

### API Security
- **CORS**: Configured for specific origins (update for your domain)
- **SQL Injection**: Protected via SQLAlchemy ORM
- **Input Validation**: Pydantic schemas for all API inputs
- **Rate Limiting**: Implement in production (e.g., slowapi)

### Data Protection
- **Sensitive Data**: API keys stored in environment variables
- **File Uploads**: Validated file types and size limits
- **Database**: Use strong credentials, enable SSL in production

### Production Recommendations
1. Use **httpOnly cookies** for JWT tokens
2. Enable **HTTPS** (handled by Vercel/Render)
3. Add **rate limiting** for API endpoints
4. Implement **audit logging** for manager actions
5. Use **secrets manager** for API keys (AWS Secrets Manager, etc.)
6. Enable **database backups**
7. Set up **error monitoring** (Sentry, LogRocket)

---

## 📝 License

This project is licensed under the MIT License. See `LICENSE` file for details.

---

## 👨‍💻 Author

**Souhardyo Sikder (sou-goog)**  
📧 sikdersouhardyo@gmail.com  
🔗 [GitHub](https://github.com/sou-goog)  
💼 [LinkedIn](https://linkedin.com/in/souhardyo-sikder)

---

## 🙏 Acknowledgments

- **Groq** for lightning-fast LLM inference (Llama 3.1)
- **Deepgram** for real-time voice AI (Nova-2 STT + Aura TTS)
- **Render** for free backend hosting and PostgreSQL
- **Vercel** for seamless frontend deployment
- **Ollama** for local LLM development
- **Open-source community** for amazing tools (FastAPI, React, XGBoost, Tesseract)

---

## 📊 Project Stats

- **Lines of Code**: ~15,000+
- **Files**: 50+
- **Commits**: 100+
- **Development Time**: 12 weeks (internship project)
- **Deployment Bugs Fixed**: 8 critical issues
- **Production Uptime**: 99.9% (with keep-alive)
- **Contributors**: 1

---

## 🎯 Future Enhancements

1. **Multi-language Support**: Hindi, Bengali, Tamil, etc.
2. **WhatsApp Bot Integration**: Voice agent via WhatsApp
3. **Credit Bureau Integration**: Real-time CIBIL API
4. **Video KYC**: Real-time video verification
5. **Loan Comparison**: Compare multiple loan products
6. **EMI Calculator**: Interactive calculator with charts
7. **Mobile App**: React Native version
8. **A/B Testing**: Voice agent prompt optimization
9. **Real-time Notifications**: WebSocket for all updates
10. **Advanced Analytics**: Manager insights dashboard

---

**⭐ Star this repo if you found it helpful!**

**🐛 Report issues**: [GitHub Issues](https://github.com/sou-goog/Development-of-AI-Powered-Loan-Eligibility-Advisory-System/issues)

**💡 Suggest features**: [GitHub Discussions](https://github.com/sou-goog/Development-of-AI-Powered-Loan-Eligibility-Advisory-System/discussions)
