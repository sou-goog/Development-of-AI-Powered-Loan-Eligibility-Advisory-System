#!/bin/bash

# AI Loan System - Setup Script
# This script automates the setup process

set -e

echo "🏦 AI Loan System - Setup"
echo "========================="

# Check Python
echo "✓ Checking Python..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.11+"
    exit 1
fi

# Check Node
echo "✓ Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node 18+"
    exit 1
fi

# Check Ollama
echo "✓ Checking Ollama..."
if ! command -v ollama &> /dev/null; then
    echo "⚠️ Ollama not found. Please install Ollama from https://ollama.ai"
fi

# Setup Backend
echo ""
echo "📦 Setting up Backend..."
cd backend

if [ ! -d "venv" ]; then
    echo "  Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

echo "  Installing dependencies..."
pip install -r requirements.txt -q

if [ ! -f ".env" ]; then
    echo "  Creating .env file..."
    cp .env.example .env
fi

# Setup Frontend
echo ""
echo "⚡ Setting up Frontend..."
cd ../frontend

if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    npm install
fi

if [ ! -f ".env" ]; then
    echo "  Creating .env file..."
    echo "REACT_APP_API_URL=http://localhost:8000/api" > .env
fi

echo ""
echo "✅ Setup Complete!"
echo ""
echo "To start the system, run: ./start.sh"
