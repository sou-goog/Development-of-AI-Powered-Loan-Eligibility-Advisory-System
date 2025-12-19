# AI Loan System - Full Stack Application

🏦 **An intelligent loan eligibility platform with AI chat, voice interaction, document verification, and PDF report generation.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black)](https://development-of-ai-powered-loan-elig.vercel.app/)
[![Backend API](https://img.shields.io/badge/Backend-Render-green)](https://ai-loan-backend-7eob.onrender.com/docs)

---

## Demo📷

https://github.com/user-attachments/assets/3bb50548-ca52-4b69-98fb-3b1bd8e47976

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Prerequisites](#prerequisites)
5. [Installation](#installation)
6. [Running the Application](#running-the-application)
7. [Environment Variables](#environment-variables)
8. [API Documentation](#api-documentation)
9. [Frontend Features](#frontend-features)
10. [Testing Guide](#testing-guide)
11. [Project Structure](#project-structure)
12. [Deployment](#deployment)
13. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

The AI Loan System automates the loan application process by:

- **Real-Time Voice Agent**: Conversational AI using WebSocket streaming (Deepgram Nova-2 STT + Groq Llama 3.1 LLM + Deepgram Aura TTS) for hands-free loan applications
- **Chat Interface**: Users interact with an AI agent (powered by Ollama/Llama3 or Gemini) to discuss loan options
- **Voice Input/Output**: Speech-to-text (Whisper) and text-to-speech (gTTS) for accessibility
- **Document Verification**: OCR-based (Tesseract) document extraction and validation
- **ML Prediction**: XGBoost model predicts loan eligibility based on applicant data
- **PDF Reports**: Jinja2 + ReportLab generates professional loan application reports
- **Manager Dashboard**: Review applications, make decisions, and download reports
- **JWT Authentication**: Secure user authentication with bcrypt password hashing

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Port 3000)               │
│  ┌────────────┐  ┌──────────┐  ┌────────────────┐          │
│  │  Chatbot   │  │  Voice   │  │ Document Upload│          │
│  │   (AI)     │  │  Agent   │  │   & Verify     │          │
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
│  │   Chat API   │  │  Voice API   │  │   OCR API    │      │
│  │  (Ollama)    │  │ (Deepgram)   │  │ (Tesseract)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Loan API    │  │ Report API   │  │ Manager API  │      │
│  │  (XGBoost)   │  │(ReportLab)   │  │   (Admin)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │    PostgreSQL/SQLite DB (SQLAlchemy ORM)           │   │
│  │    Users | Applications | Chat Sessions            │   │
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼─────┐  ┌────────▼────────┐  ┌──────▼────────┐
│   Ollama     │  │   Deepgram      │  │  Tesseract    │
│  (LLM Chat)  │  │  (Voice AI)     │  │  (OCR)        │
└──────────────┘  └─────────────────┘  └───────────────┘
```

---

## 💻 Tech Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database**: SQLite (default) or PostgreSQL via SQLAlchemy
- **Authentication**: JWT (python-jose) + bcrypt
- **LLM Chat**: Ollama (local Llama 3), Google Gemini, or OpenRouter
- **Voice (Real-time)**: Deepgram Nova-2 (STT) + Groq Llama 3.1 (LLM) + Deepgram Aura (TTS) via WebSocket
- **Voice (Batch)**: Whisper CLI (STT) + gTTS (TTS) over REST
- **Document OCR**: Tesseract (with graceful mock fallback)
- **ML Model**: XGBoost + Scikit-learn
- **PDF Generation**: Jinja2 + ReportLab

### Frontend
- **Framework**: React 18
- **Styling**: Custom CSS
- **HTTP Client**: Axios
- **Routing**: React Router v6
- **Real-time Audio**: Web Audio API + WebSocket

### Deployment
- **Frontend**: Vercel (Edge CDN)
- **Backend**: Render (Free tier)
- **Database**: Render PostgreSQL (256MB)
- **CI/CD**: GitHub Actions (keep-alive workflow)

---

## 📦 Prerequisites

### System Requirements
- **OS**: Windows, macOS, or Linux
- **Node.js**: 18.x or higher
- **Python**: 3.11 or higher
- **RAM**: 8GB+ recommended

### Required Software

#### 1. **Ollama** (LLM Chat - Optional)
```bash
# Install from https://ollama.ai
# Pull llama3 model
ollama pull llama3

# Run Ollama server
ollama serve
```

#### 2. **Tesseract** (OCR - Optional)
```bash
# macOS
brew install tesseract

# Windows
choco install tesseract

# Linux
sudo apt-get install tesseract-ocr
```

#### 3. **Node.js & npm**
```bash
node --version  # Should be 18+
npm --version   # Should be 9+
```

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/sou-goog/Development-of-AI-Powered-Loan-Eligibility-Advisory-System.git
cd Development-of-AI-Powered-Loan-Eligibility-Advisory-System
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env  # or create manually

# Edit .env with your settings (minimum required):
# SECRET_KEY=your-secret-key
# DATABASE_URL=sqlite:///./ai_loan_system.db
# GROQ_API_KEY=your-groq-key
# DEEPGRAM_API_KEY=your-deepgram-key
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Create .env file
echo "REACT_APP_API_URL=http://localhost:8000/api" > .env
```

---

## ▶️ Running the Application

### Terminal 1: Start Backend
```bash
cd backend
source venv/bin/activate
python main.py
```

**Backend will be available at**: `http://localhost:8000`  
**API Documentation**: `http://localhost:8000/docs`

### Terminal 2: Start Frontend
```bash
cd frontend
npm start
```

**Frontend will open at**: `http://localhost:3000`

### Default Login Credentials

**Applicant**
- **Email**: `user@example.com`
- **Password**: `password123`

**Manager**
- **Email**: `manager@example.com`
- **Password**: `manager123`

---

## 🔑 Environment Variables

### Backend (.env)

**Required for Voice Agent:**
```env
SECRET_KEY=change-me-in-production
DATABASE_URL=sqlite:///./ai_loan_system.db
GROQ_API_KEY=your-groq-api-key
DEEPGRAM_API_KEY=your-deepgram-api-key
```

**Optional (for local LLM chat):**
```env
LLM_PROVIDER=ollama
OLLAMA_API_URL=http://localhost:11434/api
OLLAMA_MODEL=llama3.2
```

**Optional (for Gemini):**
```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-pro
```

### Frontend (.env)

**Local Development:**
```env
REACT_APP_API_URL=http://localhost:8000/api
```

**Production:**
```env
REACT_APP_API_URL=https://ai-loan-backend-7eob.onrender.com/api
```

---

## 📚 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "full_name": "John Doe",
  "role": "applicant"
}

Response: { access_token, token_type, user }
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response: { access_token, token_type, user }
```

### Voice Agent (WebSocket)

```javascript
// Connect to real-time voice agent
const ws = new WebSocket('wss://backend-url/api/voice/stream?token=<jwt>');

// Send audio data
ws.send(JSON.stringify({
  type: "audio_chunk",
  audio: base64AudioData
}));

// Receive responses
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle audio chunks, transcripts, AI responses
};
```

### ML Prediction

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
  "confidence": 92.5
}
```

**Full API Docs**: https://ai-loan-backend-7eob.onrender.com/docs

---

## 🎨 Frontend Features

### 1. **Login/Registration**
- User registration (Applicant or Manager role)
- Secure JWT-based login
- Session management

### 2. **Applicant Dashboard**
- **Chatbot**: Interact with AI loan advisor
- **Voice Agent**: Real-time conversational loan application
- **Document Upload**: Upload ID, paystubs, bank statements
- **Eligibility Check**: View loan eligibility score

### 3. **Manager Dashboard**
- **Statistics**: Total, pending, approved, rejected applications
- **Application List**: Filter by status
- **Decision Making**: Approve or reject applications
- **Report Download**: Get PDF reports for applications

---

## 🧪 Testing Guide

### Test 1: User Registration & Login

```bash
# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "full_name": "Test User",
    "role": "applicant"
  }'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

### Test 2: Loan Eligibility Prediction

```bash
curl -X POST http://localhost:8000/api/loan/predict \
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

### Test 3: Voice Agent

1. Open frontend: `http://localhost:3000`
2. Login with default credentials
3. Click "Voice Agent" or microphone icon
4. Allow microphone access
5. Say "Hello" to start conversation

---

## 📂 Project Structure

```
ai-loan-system/
├── backend/
│   ├── main.py                          # FastAPI entry point
│   ├── requirements.txt                 # Python dependencies
│   ├── runtime.txt                      # Python 3.11.0
│   ├── .env.example                     # Environment variables template
│   └── app/
│       ├── routes/
│       │   ├── auth_routes.py          # Authentication endpoints
│       │   ├── chat_routes.py          # Chat/AI endpoints
│       │   ├── voice_routes.py         # Batch voice I/O endpoints
│       │   ├── voice_realtime_v2.py    # Real-time voice agent (WebSocket)
│       │   ├── ocr_routes.py           # Document verification
│       │   ├── loan_routes.py          # Loan prediction
│       │   ├── report_routes.py        # PDF report generation
│       │   └── manager_routes.py       # Manager dashboard
│       ├── services/
│       │   ├── ollama_service.py       # Ollama LLM integration
│       │   ├── gemini_service.py       # Google Gemini integration
│       │   ├── voice_service.py        # Whisper & gTTS
│       │   ├── ocr_service.py          # Tesseract OCR
│       │   ├── ml_model_service.py     # XGBoost predictions
│       │   └── report_service.py       # PDF generation
│       ├── models/
│       │   ├── database.py             # SQLAlchemy models
│       │   └── schemas.py              # Pydantic schemas
│       └── utils/
│           ├── security.py             # JWT & password hashing
│           └── logger.py               # Logging setup
├── frontend/
│   ├── package.json                    # Node dependencies
│   ├── .env                            # Environment variables
│   └── src/
│       ├── App.js                      # Main component
│       ├── components/
│       │   ├── Chatbot.jsx             # AI chatbot component
│       │   ├── LoginForm.jsx           # Auth form
│       │   ├── VoiceAgentRealtime_v2.jsx  # Real-time voice agent
│       │   ├── DocumentVerification.jsx   # Upload & verify
│       │   └── ManagerDashboard.jsx    # Manager UI
│       └── utils/
│           └── api.js                  # API client
├── ml/
│   ├── loan_training.py                # Model training script
│   └── app/models/                     # Trained model artifacts
├── .github/
│   └── workflows/
│       └── keep-alive.yml              # GitHub Actions keep-alive
├── render.yaml                         # Render deployment config
└── README.md                           # This file
```

---

## 🚀 Deployment

### Live Application

**Frontend**: https://development-of-ai-powered-loan-elig.vercel.app/  
**Backend**: https://ai-loan-backend-7eob.onrender.com/  
**API Docs**: https://ai-loan-backend-7eob.onrender.com/docs

### Deployment Architecture

- **Frontend**: Deployed on Vercel (global edge CDN)
- **Backend**: Deployed on Render (free tier)
- **Database**: Render PostgreSQL (256MB)
- **Keep-Alive**: GitHub Actions workflow (pings every 5 minutes)

### How It Works

1. **Vercel** hosts the React frontend with automatic deployments from GitHub
2. **Render** hosts the FastAPI backend with `render.yaml` configuration
3. **PostgreSQL** database automatically created and connected via Render
4. **GitHub Actions** pings backend every 5 minutes to prevent free-tier sleep
5. **Environment variables** configured in Render and Vercel dashboards

---

## 🔧 Troubleshooting

### Issue 1: Backend Not Responding
**Cause**: Render free tier sleeping after 15 min inactivity  
**Solution**: Wait 30 seconds for wake-up, or visit `/health` endpoint first

### Issue 2: Voice Agent Disconnected
**Cause**: WebSocket connection failed  
**Solution**: Check browser console, ensure `REACT_APP_API_URL` is correct

### Issue 3: Ollama Connection Error
```
Error: Cannot connect to Ollama
```

**Solution:**
```bash
# Start Ollama server
ollama serve

# Verify
curl http://localhost:11434/api/tags
```

### Issue 4: Tesseract Not Found
```
Error: Tesseract is not installed
```

**Solution:**
```bash
# Install Tesseract
brew install tesseract  # macOS
choco install tesseract  # Windows

# Verify
tesseract --version
```

### Issue 5: Port Already in Use
```
Error: Address already in use: ('127.0.0.1', 8000)
```

**Solution:**
```bash
# Find process
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

---

## 📊 Model Performance

The XGBoost model is trained on loan applicant data with the following features:

| Feature | Range | Impact |
|---------|-------|--------|
| Annual Income | $20K - $150K | 30% |
| Credit Score | 300 - 850 | 40% |
| Loan Amount | $5K - $500K | 20% |
| Loan Term | 12 - 60 months | 5% |
| Employment Status | Employed/Self/Unemployed | 30% |
| Dependents | 0 - 4 | 10% |

**Prediction Accuracy**: 85-92%

---

## 🔐 Security Considerations

1. **JWT Tokens**: 30-minute expiration by default
2. **Password Hashing**: bcrypt with 12 rounds
3. **CORS**: Configured for production domains
4. **Environment Variables**: Sensitive data in `.env` files
5. **SQL Injection**: Protected via SQLAlchemy ORM

---

## 📝 License

This project is open-source and available for educational purposes.

---

## 📞 Support & Documentation

- **FastAPI Docs**: http://localhost:8000/docs
- **Ollama Docs**: https://ollama.ai
- **Deepgram Docs**: https://deepgram.com/docs
- **Groq Docs**: https://console.groq.com/docs

---

**Happy Lending! 🏦💰**
