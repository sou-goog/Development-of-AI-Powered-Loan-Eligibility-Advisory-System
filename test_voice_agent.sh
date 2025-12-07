#!/bin/bash
#
# Voice Agent System Test Script
# Tests all components of the real-time voice agent
#

set -e

echo "🧪 AI Loan System - Voice Agent Test Suite"
echo "=========================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$SCRIPT_DIR/backend"

# Test 1: Check Vosk Model
echo "Test 1: Vosk Model"
echo "------------------"
VOSK_MODEL_PATH="$BACKEND_DIR/models/vosk-model-small-en-us-0.15"
if [ -d "$VOSK_MODEL_PATH" ]; then
    echo -e "${GREEN}✅ Vosk model found${NC}"
else
    echo -e "${RED}❌ Vosk model not found at: $VOSK_MODEL_PATH${NC}"
    echo "   Run: ./setup_voice_agent.sh"
    exit 1
fi

# Test 2: Check Piper Model
echo ""
echo "Test 2: Piper TTS Model"
echo "------------------------"
PIPER_MODEL_PATH="$BACKEND_DIR/models/piper/en_US-amy-medium.onnx"
if [ -f "$PIPER_MODEL_PATH" ]; then
    echo -e "${GREEN}✅ Piper model found${NC}"
else
    echo -e "${RED}❌ Piper model not found at: $PIPER_MODEL_PATH${NC}"
    echo "   Run: ./setup_voice_agent.sh"
    exit 1
fi

# Test 3: Check Python Dependencies
echo ""
echo "Test 3: Python Dependencies"
echo "----------------------------"
cd "$BACKEND_DIR"
source venv/bin/activate 2>/dev/null || {
    echo -e "${RED}❌ Virtual environment not found${NC}"
    exit 1
}

python3 -c "import vosk" 2>/dev/null && echo -e "${GREEN}✅ vosk installed${NC}" || echo -e "${RED}❌ vosk not installed${NC}"
python3 -c "import supabase" 2>/dev/null && echo -e "${GREEN}✅ supabase installed${NC}" || echo -e "${RED}❌ supabase not installed${NC}"
python3 -c "import joblib" 2>/dev/null && echo -e "${GREEN}✅ joblib installed${NC}" || echo -e "${RED}❌ joblib not installed${NC}"
python3 -c "import websockets" 2>/dev/null && echo -e "${GREEN}✅ websockets installed${NC}" || echo -e "${RED}❌ websockets not installed${NC}"

# Test 4: Check Ollama
echo ""
echo "Test 4: Ollama Service"
echo "----------------------"
if command -v ollama &> /dev/null; then
    echo -e "${GREEN}✅ Ollama installed${NC}"
    
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Ollama is running${NC}"
        
        if curl -s http://localhost:11434/api/tags | grep -q "llama3"; then
            echo -e "${GREEN}✅ Llama 3 model available${NC}"
        else
            echo -e "${YELLOW}⚠️  Llama 3 model not found${NC}"
            echo "   Run: ollama pull llama3.2"
        fi
    else
        echo -e "${YELLOW}⚠️  Ollama not running${NC}"
        echo "   Run: ollama serve"
    fi
else
    echo -e "${RED}❌ Ollama not installed${NC}"
    echo "   Install from: https://ollama.ai"
    exit 1
fi

# Test 5: Check Backend Configuration
echo ""
echo "Test 5: Backend Configuration"
echo "------------------------------"
if [ -f "$BACKEND_DIR/.env" ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"
    
    grep -q "VOSK_MODEL_PATH=" "$BACKEND_DIR/.env" && echo -e "${GREEN}✅ VOSK_MODEL_PATH configured${NC}" || echo -e "${YELLOW}⚠️  VOSK_MODEL_PATH not set${NC}"
    grep -q "PIPER_MODEL=" "$BACKEND_DIR/.env" && echo -e "${GREEN}✅ PIPER_MODEL configured${NC}" || echo -e "${YELLOW}⚠️  PIPER_MODEL not set${NC}"
else
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

# Test 6: Check Frontend Dependencies
echo ""
echo "Test 6: Frontend Dependencies"
echo "------------------------------"
cd "$SCRIPT_DIR/frontend"
if [ -d "node_modules/lucide-react" ]; then
    echo -e "${GREEN}✅ lucide-react installed${NC}"
else
    echo -e "${YELLOW}⚠️  lucide-react not installed${NC}"
    echo "   Run: npm install lucide-react"
fi

# Test 7: Check Backend Running
echo ""
echo "Test 7: Backend Service"
echo "-----------------------"
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running${NC}"
    
    # Check if WebSocket endpoint exists
    if curl -s http://localhost:8000/openapi.json | grep -q "voice/stream"; then
        echo -e "${GREEN}✅ WebSocket endpoint registered${NC}"
    else
        echo -e "${RED}❌ WebSocket endpoint not found${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Backend not running${NC}"
    echo "   Start with: cd backend && uvicorn main:app --reload"
fi

# Test 8: Check Frontend Running
echo ""
echo "Test 8: Frontend Service"
echo "------------------------"
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is running${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend not running${NC}"
    echo "   Start with: cd frontend && npm start"
fi

# Test 9: Test Piper TTS
echo ""
echo "Test 9: Piper TTS Functionality"
echo "--------------------------------"
if command -v piper &> /dev/null; then
    echo -e "${GREEN}✅ Piper CLI installed${NC}"
    
    # Try to synthesize a test phrase
    echo "Testing Piper synthesis..."
    TEST_OUTPUT="/tmp/piper_test.wav"
    echo "Hello world" | piper --model "$BACKEND_DIR/models/piper/en_US-amy-medium" --output_file "$TEST_OUTPUT" 2>/dev/null && {
        if [ -f "$TEST_OUTPUT" ]; then
            SIZE=$(stat -f%z "$TEST_OUTPUT" 2>/dev/null || stat -c%s "$TEST_OUTPUT" 2>/dev/null)
            if [ "$SIZE" -gt 1000 ]; then
                echo -e "${GREEN}✅ Piper TTS working (generated ${SIZE} bytes)${NC}"
                rm -f "$TEST_OUTPUT"
            else
                echo -e "${YELLOW}⚠️  Piper generated file too small${NC}"
            fi
        fi
    } || {
        echo -e "${YELLOW}⚠️  Piper synthesis test failed${NC}"
        echo "   This is normal if piper-tts is installed via pip"
    }
else
    echo -e "${YELLOW}⚠️  Piper CLI not in PATH${NC}"
    echo "   Install with: pip install piper-tts"
fi

# Test 10: Test Vosk Recognition (Python)
echo ""
echo "Test 10: Vosk Recognition Test"
echo "-------------------------------"
cd "$BACKEND_DIR"
python3 << 'EOF'
try:
    from vosk import Model
    import os
    model_path = os.path.join(os.path.dirname(__file__), "models", "vosk-model-small-en-us-0.15")
    model = Model(model_path)
    print("\033[0;32m✅ Vosk model loaded successfully\033[0m")
except Exception as e:
    print(f"\033[0;31m❌ Vosk test failed: {e}\033[0m")
EOF

# Summary
echo ""
echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo ""
echo "✅ = Ready"
echo "⚠️  = Needs attention"
echo "❌ = Critical issue"
echo ""
echo "If all tests passed, you can start using the voice agent!"
echo ""
echo "Quick Start:"
echo "  1. Terminal 1: cd backend && uvicorn main:app --reload"
echo "  2. Terminal 2: cd frontend && npm start"
echo "  3. Browser: http://localhost:3000/voice-agent"
echo ""
