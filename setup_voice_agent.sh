#!/bin/bash
#
# Voice Agent Setup Script
# Automates the installation of Vosk model and Piper TTS
#

set -e  # Exit on error

echo "🎙️  AI Loan System - Voice Agent Setup"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$SCRIPT_DIR/backend"
MODELS_DIR="$BACKEND_DIR/models"

echo "📁 Creating models directory..."
mkdir -p "$MODELS_DIR"
cd "$MODELS_DIR"

# Step 1: Download Vosk Model
echo ""
echo "🎙️  Step 1: Downloading Vosk Speech Recognition Model"
echo "------------------------------------------------"

VOSK_MODEL="vosk-model-small-en-us-0.15"
VOSK_URL="https://alphacephei.com/vosk/models/${VOSK_MODEL}.zip"

if [ -d "$VOSK_MODEL" ]; then
    echo -e "${YELLOW}⚠️  Vosk model already exists, skipping...${NC}"
else
    echo "📥 Downloading $VOSK_MODEL (40 MB)..."
    wget -q --show-progress "$VOSK_URL" || {
        echo -e "${RED}❌ Download failed. Please install wget or download manually.${NC}"
        exit 1
    }
    
    echo "📦 Extracting..."
    unzip -q "${VOSK_MODEL}.zip"
    rm "${VOSK_MODEL}.zip"
    
    echo -e "${GREEN}✅ Vosk model installed successfully!${NC}"
fi

# Step 2: Download Piper TTS Model
echo ""
echo "🔊 Step 2: Downloading Piper TTS Voice Model"
echo "------------------------------------------------"

PIPER_DIR="$MODELS_DIR/piper"
mkdir -p "$PIPER_DIR"
cd "$PIPER_DIR"

PIPER_VOICE="en_US-amy-medium"
PIPER_BASE_URL="https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium"

if [ -f "${PIPER_VOICE}.onnx" ]; then
    echo -e "${YELLOW}⚠️  Piper voice model already exists, skipping...${NC}"
else
    echo "📥 Downloading ${PIPER_VOICE} voice model..."
    
    wget -q --show-progress "${PIPER_BASE_URL}/${PIPER_VOICE}.onnx" || {
        echo -e "${RED}❌ Download failed. Please check your internet connection.${NC}"
        exit 1
    }
    
    wget -q --show-progress "${PIPER_BASE_URL}/${PIPER_VOICE}.onnx.json" || {
        echo -e "${RED}❌ Download failed. Please check your internet connection.${NC}"
        exit 1
    }
    
    echo -e "${GREEN}✅ Piper TTS model installed successfully!${NC}"
fi

# Step 3: Install Python Dependencies
echo ""
echo "🐍 Step 3: Installing Python Dependencies"
echo "------------------------------------------------"

cd "$BACKEND_DIR"

if [ ! -d "venv" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment not found. Creating...${NC}"
    python3 -m venv venv
fi

echo "📦 Installing vosk, supabase, and other dependencies..."
source venv/bin/activate

pip install -q vosk==0.3.45 supabase==2.3.4 joblib==1.3.2 websockets==12.0 || {
    echo -e "${RED}❌ pip install failed. Please check your Python installation.${NC}"
    exit 1
}

echo -e "${GREEN}✅ Python dependencies installed!${NC}"

# Step 4: Install Piper TTS CLI
echo ""
echo "🔊 Step 4: Installing Piper TTS CLI"
echo "------------------------------------------------"

if command -v piper &> /dev/null; then
    echo -e "${GREEN}✅ Piper TTS already installed${NC}"
else
    echo "📦 Installing piper-tts via pip..."
    pip install -q piper-tts || {
        echo -e "${YELLOW}⚠️  pip install failed. Trying alternative method...${NC}"
        
        # Try downloading pre-built binary
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo "🍎 Detected macOS - Please install Piper manually:"
            echo "   brew install piper-tts"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            echo "🐧 Detected Linux - Downloading pre-built binary..."
            PIPER_RELEASE="https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz"
            wget -q --show-progress "$PIPER_RELEASE"
            tar -xzf piper_amd64.tar.gz
            chmod +x piper
            echo "   To complete installation, run: sudo mv piper /usr/local/bin/"
        fi
    }
fi

# Step 5: Verify Ollama
echo ""
echo "🤖 Step 5: Verifying Ollama Installation"
echo "------------------------------------------------"

if command -v ollama &> /dev/null; then
    echo -e "${GREEN}✅ Ollama is installed${NC}"
    
    # Check if Ollama is running
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Ollama is running${NC}"
        
        # Check if llama3.2 model is available
        if curl -s http://localhost:11434/api/tags | grep -q "llama3.2"; then
            echo -e "${GREEN}✅ Llama 3.2 model is available${NC}"
        else
            echo -e "${YELLOW}⚠️  Llama 3.2 model not found. Pulling...${NC}"
            ollama pull llama3.2
        fi
    else
        echo -e "${YELLOW}⚠️  Ollama is not running. Starting...${NC}"
        ollama serve > /dev/null 2>&1 &
        sleep 3
        ollama pull llama3.2
    fi
else
    echo -e "${RED}❌ Ollama is not installed!${NC}"
    echo "   Please install from: https://ollama.ai"
    exit 1
fi

# Step 6: Update .env file
echo ""
echo "⚙️  Step 6: Updating .env Configuration"
echo "------------------------------------------------"

ENV_FILE="$BACKEND_DIR/.env"

if [ -f "$ENV_FILE" ]; then
    echo "📝 Updating $ENV_FILE..."
    
    # Update VOSK_MODEL_PATH
    if grep -q "VOSK_MODEL_PATH=" "$ENV_FILE"; then
        sed -i.bak "s|VOSK_MODEL_PATH=.*|VOSK_MODEL_PATH=./models/$VOSK_MODEL|" "$ENV_FILE"
    else
        echo "VOSK_MODEL_PATH=./models/$VOSK_MODEL" >> "$ENV_FILE"
    fi
    
    # Update PIPER_MODEL
    if grep -q "PIPER_MODEL=" "$ENV_FILE"; then
        sed -i.bak "s|PIPER_MODEL=.*|PIPER_MODEL=./models/piper/$PIPER_VOICE|" "$ENV_FILE"
    else
        echo "PIPER_MODEL=./models/piper/$PIPER_VOICE" >> "$ENV_FILE"
    fi
    
    rm -f "$ENV_FILE.bak"
    echo -e "${GREEN}✅ .env file updated${NC}"
else
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "   Please copy .env.example to .env first"
fi

# Step 7: Install Frontend Dependencies
echo ""
echo "🎨 Step 7: Installing Frontend Dependencies"
echo "------------------------------------------------"

cd "$SCRIPT_DIR/frontend"

if [ ! -d "node_modules/lucide-react" ]; then
    echo "📦 Installing lucide-react..."
    npm install lucide-react || {
        echo -e "${YELLOW}⚠️  npm install failed. Please run manually: npm install lucide-react${NC}"
    }
else
    echo -e "${GREEN}✅ lucide-react already installed${NC}"
fi

# Summary
echo ""
echo "=========================================="
echo -e "${GREEN}🎉 Voice Agent Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "📋 What was installed:"
echo "  ✅ Vosk Speech Recognition Model ($VOSK_MODEL)"
echo "  ✅ Piper TTS Voice Model ($PIPER_VOICE)"
echo "  ✅ Python dependencies (vosk, supabase, joblib, websockets)"
echo "  ✅ Ollama + Llama 3.2 (verified)"
echo "  ✅ Frontend dependencies (lucide-react)"
echo ""
echo "🚀 Next Steps:"
echo "  1. Start backend:  cd backend && source venv/bin/activate && uvicorn main:app --reload"
echo "  2. Start frontend: cd frontend && npm start"
echo "  3. Open browser:   http://localhost:3000/voice-agent"
echo "  4. Click the green phone button and start talking!"
echo ""
echo "📖 For detailed documentation, see: VOICE_AGENT_SETUP.md"
echo ""
