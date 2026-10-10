#!/bin/bash
# HeatPath - Local Development Start Script

set -e

echo "🔥 Starting HeatPath locally..."
echo "================================"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required. Please install it."
    exit 1
fi

# Check Node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Please install it."
    exit 1
fi

# Setup backend
echo ""
echo "📦 Setting up Python backend..."
cd backend

if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  Created backend/.env — add your AWS credentials there!"
fi

if [ ! -d venv ]; then
    python3 -m venv venv
    echo "✅ Created Python venv"
fi

source venv/bin/activate
pip install -r requirements.txt -q
echo "✅ Python dependencies installed"

# Start backend in background
echo ""
echo "🚀 Starting FastAPI backend on http://localhost:8000..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

cd ..

# Setup frontend
echo ""
echo "📦 Setting up Next.js frontend..."
cd frontend

if [ ! -d node_modules ]; then
    npm install
    echo "✅ Node dependencies installed"
fi

# Copy frontend env
if [ ! -f .env.local ]; then
    echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
    echo "✅ Created frontend/.env.local"
fi

echo ""
echo "🚀 Starting Next.js frontend on http://localhost:3000..."
npm run dev &
FRONTEND_PID=$!

cd ..

echo ""
echo "================================"
echo "✅ HeatPath is running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."
echo "================================"

# Cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait
