#!/bin/bash

# AI Loan System - Start All Services
# Run this script to start all components

echo "🏦 Starting AI Loan System..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run command in new terminal
run_in_terminal() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        osascript -e "tell app \"Terminal\" to do script \"cd '$1' && $2\""
    else
        # Linux
        gnome-terminal -- bash -c "cd '$1' && $2; bash"
    fi
}

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${YELLOW}Starting services...${NC}"
echo ""

# Check Ollama
if ! lsof -Pi :11434 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}▶ Starting Ollama...${NC}"
    run_in_terminal "$PROJECT_ROOT" "ollama serve"
    sleep 2
else
    echo -e "${GREEN}✓ Ollama already running on port 11434${NC}"
fi

# Check Backend
if ! lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}▶ Starting Backend...${NC}"
    run_in_terminal "$PROJECT_ROOT/backend" "source venv/bin/activate && python main.py"
    sleep 3
else
    echo -e "${GREEN}✓ Backend already running on port 8000${NC}"
fi

# Check Frontend
if ! lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}▶ Starting Frontend...${NC}"
    run_in_terminal "$PROJECT_ROOT/frontend" "npm start"
    sleep 2
else
    echo -e "${GREEN}✓ Frontend already running on port 3000${NC}"
fi

echo ""
echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo "📍 Access your application:"
echo "   Frontend: ${GREEN}http://localhost:3000${NC}"
echo "   Backend:  ${GREEN}http://localhost:8000${NC}"
echo "   API Docs: ${GREEN}http://localhost:8000/docs${NC}"
echo ""
