#!/bin/bash

# AI Loan System - Quick Start Script for macOS
# This script automates the setup process

set -e

echo "🏦 AI Loan System - Quick Setup"
echo "=================================="

# Check Python
echo "✓ Checking Python..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.11+"
    exit 1
fi
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "  Python version: $PYTHON_VERSION"

# Check Node
echo "✓ Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node 18+"
    exit 1
fi
NODE_VERSION=$(node -v)
echo "  Node version: $NODE_VERSION"

# Check Ollama
echo "✓ Checking Ollama..."
if ! command -v ollama &> /dev/null; then
    echo "⚠️  Ollama not found. Install from https://ollama.ai"
    echo "   Then run: ollama pull llama3"
fi

# Check Tesseract
echo "✓ Checking Tesseract..."
if ! command -v tesseract &> /dev/null; then
    echo "⚠️  Tesseract not found. Installing via Homebrew..."
    brew install tesseract || echo "Please install Tesseract manually: brew install tesseract"
fi

# Check FFmpeg (required for Whisper to decode webm/opus)
echo "✓ Checking FFmpeg..."
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  FFmpeg not found. Installing via Homebrew..."
    brew install ffmpeg || echo "Please install FFmpeg manually: brew install ffmpeg"
fi

# Setup Backend
echo ""
echo "📦 Setting up Backend..."
cd backend

if [ ! -d "venv" ]; then
    echo "  Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "  Installing dependencies..."
pip install -r requirements.txt -q

if [ ! -f ".env" ]; then
    echo "  Creating .env file..."
    cp .env.example .env
fi

# Note: ML Model training is skipped - user will provide their own trained model
echo "📊 ML Model: User will provide their own trained model file"

# Setup Frontend
echo ""
echo "⚡ Setting up Frontend..."
cd ../frontend

if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    npm install -q
fi

if [ ! -f ".env" ]; then
    echo "  Creating .env file..."
    echo "REACT_APP_API_URL=http://localhost:8000/api" > .env
fi

echo ""
echo "✅ Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Start Ollama in a new terminal:"
echo "   ollama serve"
echo ""
echo "2. Start Backend in a new terminal:"
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   python main.py"
echo ""
echo "3. Start Frontend in a new terminal:"
echo "   cd frontend"
echo "   npm start"
echo ""
echo "4. Open http://localhost:3000 in your browser"
echo ""
echo "🔊 Voice prerequisites:"
echo "   - Ensure FFmpeg is installed (brew install ffmpeg)"
echo "   - Whisper CLI is installed via requirements (openai-whisper)"
echo "   - Check status at: http://localhost:8000/api/voice/status"
echo ""
echo "🎉 Happy Lending!"
