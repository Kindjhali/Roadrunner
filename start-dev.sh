#!/bin/bash

echo "Starting Roadrunner Autocoder Development Environment"
echo "====================================================="
echo

echo "Starting Backend Server (Port 3333)..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

echo "Waiting 3 seconds for backend to initialize..."
sleep 3

echo "Starting Frontend Server (Port 5733)..."
npm run dev &
FRONTEND_PID=$!

echo
echo "====================================================="
echo "Roadrunner Autocoder is running!"
echo
echo "Frontend: http://localhost:5733"
echo "Backend:  http://localhost:3333"
echo
echo "Press Ctrl+C to stop both servers"
echo "====================================================="
echo

# Function to cleanup processes on exit
cleanup() {
    echo
    echo "Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "Servers stopped."
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for processes
wait
