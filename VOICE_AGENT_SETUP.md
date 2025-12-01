# Real-Time Voice Agent Setup Guide

## 🎯 Overview
This guide will help you set up the **100% free, real-time streaming voice agent** for the AI Loan System using:
- **Vosk** for speech recognition (offline, real-time)
- **Ollama + Llama 3** for AI brain (streaming responses)
- **Piper TTS** for text-to-speech (fast, local)
- **Supabase** for conversation logging (optional)

---

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ Python 3.8+ installed
- ✅ Node.js 16+ installed
- ✅ Ollama installed and running
- ✅ 2-4 GB free disk space (for models)
- ✅ Working microphone

---

## 🔧 Step 1: Install Backend Dependencies

```bash
cd backend

# Activate virtual environment
source venv/bin/activate  # On macOS/Linux
# or
venv\Scripts\activate  # On Windows

# Install voice agent packages
pip install vosk==0.3.45 supabase==2.3.4 joblib==1.3.2 websockets==12.0
```

---

## 🎙️ Step 2: Download Vosk Speech Recognition Model

### Option A: Small Model (Recommended for Testing)
**Size:** ~40 MB | **Speed:** Very Fast | **Accuracy:** Good

```bash
# Create models directory
mkdir -p backend/models
cd backend/models

# Download small English model
wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip

# Extract
unzip vosk-model-small-en-us-0.15.zip

# Verify
ls vosk-model-small-en-us-0.15/
# Should see: am/, conf/, graph/, ivector/, README
```

### Option B: Large Model (Better Accuracy)
**Size:** ~1.8 GB | **Speed:** Fast | **Accuracy:** Excellent

```bash
cd backend/models

# Download large English model
wget https://alphacephei.com/vosk/models/vosk-model-en-us-0.22.zip

# Extract
unzip vosk-model-en-us-0.22.zip
```

**Update `.env`** to point to your model:
```bash
VOSK_MODEL_PATH=./backend/models/vosk-model-small-en-us-0.15
# or
VOSK_MODEL_PATH=./backend/models/vosk-model-en-us-0.22
```

---

## 🔊 Step 3: Install Piper TTS

### macOS (Homebrew)
```bash
# Install via pip (recommended)
pip install piper-tts

# Or build from source
git clone https://github.com/rhasspy/piper.git
cd piper/src/python
pip install -e .
```

### Linux
```bash
# Install via pip
pip install piper-tts

# Or download pre-built binary
wget https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz
tar -xvf piper_amd64.tar.gz
sudo mv piper /usr/local/bin/
```

### Windows
```powershell
# Install via pip
pip install piper-tts

# Or download from releases
# https://github.com/rhasspy/piper/releases
```

### Download Piper Voice Model

```bash
# Create piper models directory
mkdir -p backend/models/piper

# Download Amy voice (American English, medium quality)
cd backend/models/piper
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json
```

**Update `.env`:**
```bash
PIPER_MODEL=./backend/models/piper/en_US-amy-medium
```

---

## 🤖 Step 4: Configure Ollama

Ensure Ollama is running with Llama 3:

```bash
# Start Ollama (if not already running)
ollama serve &

# Pull Llama 3 model (if not already done)
ollama pull llama3.2

# Test streaming mode
echo "Hello, how are you?" | ollama run llama3.2 --stream
```

**Update `.env`:**
```bash
OLLAMA_MODEL=llama3.2
OLLAMA_API_URL=http://localhost:11434/api
```

---

## 🗄️ Step 5: Setup Supabase (Optional but Recommended)

### Create Supabase Project

1. Go to https://supabase.com and sign up (free tier)
2. Create a new project
3. Go to **Settings** → **API** and copy:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon Key**: `eyJhbGciOiJIUzI1NiIs...`

### Create Database Table

In Supabase SQL Editor, run:

```sql
CREATE TABLE voice_stream_sessions (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_text TEXT,
  ai_reply TEXT,
  structured_data JSONB,
  eligibility_score FLOAT
);

-- Enable Row Level Security (optional)
ALTER TABLE voice_stream_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for logging)
CREATE POLICY "Allow anonymous inserts"
  ON voice_stream_sessions
  FOR INSERT
  TO anon
  WITH CHECK (true);
```

**Update `.env`:**
```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIs...
```

---

## 🔗 Step 6: Register WebSocket Route

Update `backend/main.py` to include the voice realtime route:

```python
from app.routes import voice_realtime_v2

# Add to your route includes
app.include_router(
    voice_realtime_v2.router,
    prefix="/api",
    tags=["voice"]
)
```

---

## 🎨 Step 7: Add Frontend Component

Update `frontend/src/App.js` to include the voice agent:

```jsx
import VoiceAgentRealtime from './components/VoiceAgentRealtime_v2';

// Add a route
<Route path="/voice-agent" element={<VoiceAgentRealtime />} />
```

### Install Lucide Icons

```bash
cd frontend
npm install lucide-react
```

---

## 🚀 Step 8: Start Everything

### Terminal 1: Backend
```bash
cd backend
source venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal 2: Frontend
```bash
cd frontend
npm start
```

### Terminal 3: Ollama (if not already running)
```bash
ollama serve
```

---

## ✅ Step 9: Test the Voice Agent

1. Open browser: http://localhost:3000/voice-agent
2. Click the **green phone button** to start
3. Grant microphone permissions when prompted
4. Start speaking: "Hello, I'd like to apply for a loan"
5. The AI will respond with voice and text

### Test Conversation Flow

**You:** "Hi, my name is John Smith"  
**AI:** "Hello John! I'll help with your loan application. What's your monthly income?"

**You:** "I make five thousand dollars per month"  
**AI:** "Got it, $5000 monthly. What's your credit score?"

**You:** "My credit score is 720"  
**AI:** "Great score! How much would you like to borrow?"

**You:** "I need a twenty thousand dollar loan"  
**AI:** "Perfect! Let me check your eligibility..."

🎉 **Result:** The system will show approval probability!

---

## 🐛 Troubleshooting

### Issue: Vosk model not found
```bash
# Verify model path
ls backend/models/vosk-model-small-en-us-0.15/

# Update .env with correct path
VOSK_MODEL_PATH=./backend/models/vosk-model-small-en-us-0.15
```

### Issue: Piper command not found
```bash
# Check if installed
which piper

# If not found, install via pip
pip install piper-tts

# Or add to PATH
export PATH=$PATH:/path/to/piper
```

### Issue: Ollama not responding
```bash
# Check if running
ps aux | grep ollama

# Restart Ollama
killall ollama
ollama serve &

# Test
curl http://localhost:11434/api/tags
```

### Issue: WebSocket connection failed
```bash
# Check backend is running on port 8000
curl http://localhost:8000/health

# Check WebSocket route exists
curl http://localhost:8000/openapi.json | jq '.paths' | grep voice
```

### Issue: No audio playback
- Check browser permissions (microphone + audio)
- Try in Chrome/Edge (best WebRTC support)
- Check console for errors (F12 → Console)

### Issue: Microphone not capturing
```bash
# Test microphone in browser
# Go to: chrome://settings/content/microphone
# Allow for localhost
```

---

## 📊 Performance Optimization

### For Low-Latency Streaming:

1. **Use Small Vosk Model:** `vosk-model-small-en-us-0.15` (40MB)
2. **Use Llama 3.2:** Faster than Llama 3
3. **Use Medium Piper Voice:** Balance between quality and speed
4. **Reduce MediaRecorder chunk size:** 100ms (already set)

### For Better Accuracy:

1. **Use Large Vosk Model:** `vosk-model-en-us-0.22` (1.8GB)
2. **Use Llama 3 or Llama 3.1:** Better reasoning
3. **Use High-Quality Piper Voice:** `en_US-amy-high`

---

## 🌍 Deployment to Render

### Dockerfile (backend)

```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Copy app
WORKDIR /app
COPY backend/ .

# Install Python packages
RUN pip install --no-cache-dir -r requirements.txt

# Download Vosk model
RUN mkdir -p models && \
    cd models && \
    wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip && \
    unzip vosk-model-small-en-us-0.15.zip && \
    rm vosk-model-small-en-us-0.15.zip

# Download Piper model
RUN mkdir -p models/piper && \
    cd models/piper && \
    wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx && \
    wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json

# Expose port
EXPOSE 8000

# Start app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### render.yaml

```yaml
services:
  - type: web
    name: ai-loan-backend
    env: docker
    dockerfilePath: ./Dockerfile
    envVars:
      - key: VOSK_MODEL_PATH
        value: ./models/vosk-model-small-en-us-0.15
      - key: PIPER_MODEL
        value: ./models/piper/en_US-amy-medium
      - key: OLLAMA_API_URL
        value: http://ollama:11434/api
      - key: SUPABASE_URL
        value: your_supabase_url
      - key: SUPABASE_KEY
        value: your_supabase_key

  - type: web
    name: ollama
    env: docker
    dockerContext: ./ollama
    dockerfilePath: ./Dockerfile
```

---

## 📚 Additional Resources

- **Vosk Models:** https://alphacephei.com/vosk/models
- **Piper TTS:** https://github.com/rhasspy/piper
- **Piper Voices:** https://huggingface.co/rhasspy/piper-voices
- **Ollama Docs:** https://ollama.ai/docs
- **Supabase Docs:** https://supabase.com/docs

---

## ✨ Next Steps

1. **Improve Structured Extraction:** Use LLM to extract fields more accurately
2. **Add More Questions:** Ask about employment, dependents, etc.
3. **Voice Authentication:** Verify speaker identity
4. **Multi-Language:** Add Spanish, Hindi, etc.
5. **Emotion Detection:** Analyze voice tone for risk assessment

---

**Congratulations! 🎉 Your real-time voice agent is ready!**

Now you have a fully functional, streaming voice assistant that runs 100% free, 100% locally, and can be deployed to production!
