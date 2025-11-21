# 🎙️ Real-Time Voice Agent - Quick Start

## ⚡ 5-Minute Setup

### 1. Run Setup Script
```bash
cd /Users/mylaptop/Desktop/AI-loan-system-main
./setup_voice_agent.sh
```

This will automatically:
- Download Vosk model (40 MB)
- Download Piper TTS voice model
- Install Python dependencies
- Update .env configuration
- Install frontend dependencies

### 2. Start Services

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

**Terminal 3 - Ollama (if not running):**
```bash
ollama serve
```

### 3. Test Voice Agent

1. Open: http://localhost:3000/voice-agent
2. Click green phone button 📞
3. Allow microphone access
4. Start talking!

---

## 🎯 How It Works

### Architecture Flow

```
┌──────────────┐
│   Browser    │
│  (You Talk)  │
└──────┬───────┘
       │ Audio Chunks (WebSocket)
       ↓
┌──────────────┐
│   Backend    │
│  - Vosk STT  │ ← Transcribes your speech in real-time
│  - Ollama AI │ ← Generates intelligent responses
│  - Piper TTS │ ← Converts text to speech
└──────┬───────┘
       │ Audio Chunks + Text (WebSocket)
       ↓
┌──────────────┐
│   Browser    │
│ (AI Speaks)  │
└──────────────┘
```

### Data Flow Example

**You:** "Hi, my name is John"
→ Vosk transcribes → "Hi, my name is John"
→ AI processes → Extracts: `{name: "John"}`
→ AI responds → "Hello John! What's your monthly income?"
→ Piper synthesizes → Audio WAV chunk
→ Browser plays → You hear AI voice

---

## 🧪 Testing the Agent

### Sample Conversation

```
You: "Hello, I'd like to apply for a loan"
AI:  "Hi there! I'd be happy to help. What's your name?"

You: "My name is Sarah Johnson"
AI:  "Nice to meet you, Sarah! What's your monthly income?"

You: "I make six thousand dollars per month"
AI:  "Got it, $6000 monthly. What's your credit score?"

You: "My credit score is 750"
AI:  "Excellent score! How much would you like to borrow?"

You: "I need a thirty thousand dollar loan"
AI:  "Perfect! Let me check your eligibility..."

Result: ✅ Loan Approved (92% probability)
```

---

## 📊 What Gets Extracted

The AI automatically extracts:
- **Name:** From "my name is..." or "I'm..."
- **Monthly Income:** From "$5000" or "five thousand dollars"
- **Credit Score:** Numbers between 300-850
- **Loan Amount:** From "need $20000" or "borrow 20k"

Once all 4 fields are collected, ML model runs automatically!

---

## 🔧 Configuration

### Environment Variables (.env)

```bash
# Vosk model path (downloaded by setup script)
VOSK_MODEL_PATH=./models/vosk-model-small-en-us-0.15

# Piper TTS model (downloaded by setup script)
PIPER_MODEL=./models/piper/en_US-amy-medium

# Ollama configuration
OLLAMA_MODEL=llama3.2
OLLAMA_API_URL=http://localhost:11434/api

# Supabase (optional - for logging)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

---

## 🎨 Frontend Integration

### Add to Your App.js

```jsx
import VoiceAgentRealtime from './components/VoiceAgentRealtime_v2';

function App() {
  return (
    <Router>
      <Routes>
        {/* Existing routes */}
        <Route path="/voice-agent" element={<VoiceAgentRealtime />} />
      </Routes>
    </Router>
  );
}
```

### Add Navigation Link

```jsx
<Link to="/voice-agent">
  🎙️ Voice Agent
</Link>
```

---

## 🐛 Common Issues & Fixes

### "WebSocket connection failed"
```bash
# Check backend is running
curl http://localhost:8000/health

# Check route exists
curl http://localhost:8000/openapi.json | grep voice
```

### "Vosk model not found"
```bash
# Re-run setup script
./setup_voice_agent.sh

# Or download manually
cd backend/models
wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip vosk-model-small-en-us-0.15.zip
```

### "Piper command not found"
```bash
# Install via pip
pip install piper-tts

# Or on macOS
brew install piper-tts
```

### "Ollama not responding"
```bash
# Check if running
ps aux | grep ollama

# Restart
killall ollama
ollama serve &

# Pull model
ollama pull llama3.2
```

### "No audio playback"
- Check browser permissions (microphone + audio)
- Try Chrome/Edge (best WebRTC support)
- Check browser console (F12) for errors

---

## 📈 Performance Tips

### For Fastest Response:
- Use small Vosk model (40MB)
- Use Llama 3.2 (faster than Llama 3)
- Use medium Piper voice

### For Best Accuracy:
- Use large Vosk model (1.8GB)
- Use Llama 3.1 (better reasoning)
- Use high-quality Piper voice

---

## 🌍 Deployment Checklist

### Before Deploying to Render:

- [x] Test locally with all services running
- [x] Configure Supabase for production logging
- [x] Update CORS origins in main.py
- [x] Build Docker image with models included
- [x] Test WebSocket connectivity with wss://

### Docker Build:
```bash
cd backend
docker build -t ai-loan-voice-agent .
docker run -p 8000:8000 ai-loan-voice-agent
```

---

## 📚 API Documentation

### WebSocket Endpoint
```
ws://localhost:8000/api/voice/stream
```

### Message Types

**From Client:**
- Binary frames: Raw audio (PCM16LE, 16kHz, mono)
- JSON: `{"type": "end_session"}` to disconnect

**From Server:**
- `partial_transcript`: Live transcription
- `final_transcript`: Complete sentence
- `ai_token`: AI response token
- `audio_chunk`: Base64 WAV chunk
- `structured_update`: Extracted fields
- `eligibility_result`: ML prediction
- `error`: Error message

---

## 🎯 Next Features to Add

1. **Multi-turn conversations** with context memory
2. **Voice authentication** for security
3. **Multi-language support** (Spanish, Hindi, etc.)
4. **Emotion detection** from voice tone
5. **Background noise filtering**
6. **Voice interruption** handling
7. **Conversation summaries** with LLM
8. **Voice biometrics** for fraud detection

---

## ✨ Success Metrics

Your voice agent is working when:
- ✅ WebSocket connects successfully
- ✅ You see "🎤 Listening..." when talking
- ✅ Partial transcripts appear in real-time
- ✅ AI responds with voice AND text
- ✅ Structured data gets extracted automatically
- ✅ ML model runs when all fields collected
- ✅ Eligibility result displays

---

## 🤝 Support

If you encounter issues:
1. Check logs: `backend/logs/app.log`
2. Check browser console (F12)
3. Verify all services running
4. Re-run setup script
5. See full docs: `VOICE_AGENT_SETUP.md`

---

**🎉 Congratulations! You now have a production-ready, real-time voice agent running 100% free!**
