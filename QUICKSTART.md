# Quick Reference for AI Loan System

## 🚀 Quick Start Commands

### First Time Setup
```bash
cd ai-loan-system
chmod +x setup.sh
./setup.sh
```

### Run All Services Locally
```bash
chmod +x start.sh
./start.sh
```

### Deploy to Cloud (Recommended)
See the deployment section below for cloud hosting.

## 🔧 Manual Start (3 Terminals)

### Terminal 1: Ollama (LLM) - Local Only
```bash
ollama serve
# Waits for requests on http://localhost:11434
```

### Terminal 2: Backend
```bash
cd backend
source venv/bin/activate
python main.py
# FastAPI running on http://localhost:8000
# Swagger UI: http://localhost:8000/docs
```

### Terminal 3: Frontend
```bash
cd frontend
npm start
# React app opens at http://localhost:3000
```

## 📝 Test Credentials

### Applicant Account
- Email: `applicant@example.com`
- Password: `Test123!`
- Role: `applicant`

### Manager Account
- Email: `manager@example.com`
- Password: `Test123!`
- Role: `manager`

## 🧪 Test the API

### Register New User
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123",
    "full_name": "New User",
    "role": "applicant"
  }'
```

### Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123"
  }'
```

### Chat with AI
```bash
curl -X POST http://localhost:8000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hi, I want to apply for a loan",
    "application_id": null
  }'
```
**Response**: Conversational guidance through the loan application process, automatically collecting information and running eligibility checks.

### Check Loan Eligibility
```bash
curl -X POST http://localhost:8000/api/loan/predict \
  -H "Content-Type: application/json" \
  -d '{
    "annual_income": 75000,
    "credit_score": 750,
    "loan_amount": 100000,
    "loan_term_months": 60,
    "num_dependents": 2,
    "employment_status": "employed"
  }'
```

## 📂 Important Directories

| Path | Purpose |
|------|---------|
| `backend/app/static/uploads/` | User uploaded documents |
| `backend/app/static/reports/` | Generated PDF reports |
| `backend/app/static/voices/` | Audio files (voices) |
| `backend/app/models/` | ML models and database |
| `backend/logs/` | Application logs |
| `frontend/src/` | React components |

## 🔍 Check Service Health

```bash
# Ollama
curl http://localhost:11434/api/tags

# Backend
curl http://localhost:8000/health

# Chat Service
curl http://localhost:8000/api/chat/health

# Clear LLM cache (admin)
curl -X POST http://localhost:8000/api/chat/admin/clear-cache

# Voice Service
curl http://localhost:8000/api/voice/status

# OCR Service
curl http://localhost:8000/api/verify/status
```

## 🔐 Environment Variables

### Backend (.env)
```
SECRET_KEY=your-secret-key-change-this
DATABASE_URL=sqlite:///./ai_loan_system.db
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
OLLAMA_API_URL=http://localhost:11434/api
OLLAMA_MODEL=llama3.2
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct
```

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:8000/api
```

## 🗣️ Voice AI Agent

The project includes a built-in voice agent using the browser mic and backend `/api/voice/voice_agent`.

Frontend needs no extra SDK. Just run the app, click the Speak button in the chat UI, and talk.

## 💬 Example Conversation Flow

**User**: Hi, I want to apply for a ₹5,00,000 loan

**AI**: Hello! I'm your AI loan assistant. I'll help you apply for a loan and check your eligibility. To get started, could you please tell me your full name?
**AI**: Thank you for sharing that information. I've noted your annual income of ₹8,00,000. To help determine the right loan amount for you, could you tell me your annual income?

**User**: I have a credit score of 750 and work as salaried employee

**AI**: Thank you for sharing that information. I've noted your credit score of 750, employment as salaried. Perfect! I have all the key information I need. Let me run a quick eligibility check to see what loan options might be available for you. Based on the information you've shared, here's what I found: [eligibility results]

The chatbot now guides users conversationally through the entire loan application process without yes/no questions!

## ☁️ Cloud Deployment

### Backend (Render)
1. Create a Render account at https://render.com
2. Connect your GitHub repo
3. Create a new Web Service from the `render.yaml` blueprint
4. Set environment variables in Render dashboard:
   - `GEMINI_API_KEY`: Your Google AI Studio API key
   - `SECRET_KEY`: Generate a random string
5. Deploy - your backend will be live at `https://your-app.onrender.com`

### Frontend (Vercel)
1. Create a Vercel account at https://vercel.com
2. Connect your GitHub repo
3. Deploy the `frontend` directory
4. Set environment variables in Vercel dashboard:
  - `REACT_APP_API_URL`: Your Render backend URL (e.g., `https://your-app.onrender.com/api`)
5. Deploy - your frontend will be live at `https://your-app.vercel.app`

### Database
- Render automatically provisions a free Postgres database
- No additional setup needed

### LLM Configuration
- The backend defaults to Gemini for cloud deployment
- Get your Gemini API key from https://makersuite.google.com/app/apikey
- Set `GEMINI_API_KEY` in your Render environment variables
- Model: `gemini-1.5-flash` (15 requests/minute free tier limit)
- **Caching**: Responses are cached for 1 hour to reduce API calls

### Post-Deployment
- Update your frontend's `REACT_APP_API_URL` if the backend URL changes
- Test the chat and voice features
- Monitor logs in Render/Vercel dashboards

## 🐛 Debugging

### View Backend Logs
```bash
tail -f backend/logs/app.log
```

### Check Database
```bash
# Using sqlite3
sqlite3 backend/ai_loan_system.db ".tables"
sqlite3 backend/ai_loan_system.db "SELECT * FROM users;"
```

### Frontend Console
Open browser DevTools (F12) and check Console tab for errors.

## 🆘 Common Issues & Fixes

### Port Already in Use
```bash
# Find and kill process
lsof -i :8000
kill -9 <PID>
```

### Ollama Not Responding
```bash
# Restart Ollama
killall ollama
ollama serve
```
# Switch chatbot provider per request (override)
The chat API supports an optional `provider` field in the request body to override the provider without editing `.env`:
```bash
curl -s -X POST http://localhost:8000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hi there",
    "application_id": null,
    "provider": "ollama"  # or "openrouter" | "gemini"
  }'
```

### Ollama Pull Timeout (TLS handshake timeout)
If pulling `llama3` fails due to network issues, use an already-available local model (e.g., `llama3.2`) and point the backend to it:
```bash
# Check local models
ollama list

# Set backend to use an existing local tag
cd ai-loan-system/backend
cp .env.example .env  # if not created yet
sed -i.bak 's/^OLLAMA_MODEL=.*/OLLAMA_MODEL=llama3.2/' .env

# Verify via API
curl -s http://localhost:11434/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"model":"llama3.2","prompt":"Say ready.","stream":false}'
```

### Database Locked
```bash
# Reset database
rm backend/ai_loan_system.db
# Restart backend
```

### Module Not Found
```bash
# Reinstall dependencies
cd frontend
npm install
```

## 📊 Sample Loan Application Data

### Good Credit Profile
```json
{
  "annual_income": 120000,
  "credit_score": 780,
  "loan_amount": 300000,
  "loan_term_months": 360,
  "num_dependents": 2,
  "employment_status": "employed"
}
```
**Expected Result**: ~0.95 eligibility score (Highly Eligible)

### Fair Credit Profile
```json
{
  "annual_income": 50000,
  "credit_score": 650,
  "loan_amount": 50000,
  "loan_term_months": 60,
  "num_dependents": 1,
  "employment_status": "employed"
}
```
**Expected Result**: ~0.55 eligibility score (Borderline)

### Poor Credit Profile
```json
{
  "annual_income": 30000,
  "credit_score": 550,
  "loan_amount": 100000,
  "loan_term_months": 60,
  "num_dependents": 3,
  "employment_status": "unemployed"
}
```
**Expected Result**: ~0.25 eligibility score (Ineligible)

## 📚 Documentation Links

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [Ollama](https://ollama.ai/)
- [Whisper](https://github.com/openai/whisper)
- [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki)

---

For more details, see `README.md`
