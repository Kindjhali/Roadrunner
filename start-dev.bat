@echo off
echo Starting Roadrunner Autocoder Development Environment
echo =====================================================
echo.

echo Starting Backend Server (Port 3333)...
start "Roadrunner Backend" cmd /k "cd backend && npm start"

echo Waiting 3 seconds for backend to initialize...
timeout /t 3 /nobreak >nul

echo Starting Frontend Server (Port 5733)...
start "Roadrunner Frontend" cmd /k "npm run dev"

echo.
echo =====================================================
echo Roadrunner Autocoder is starting up!
echo.
echo Frontend: http://localhost:5733
echo Backend:  http://localhost:3333
echo.
echo Both servers are running in separate windows.
echo Close this window or press Ctrl+C to stop monitoring.
echo =====================================================
echo.

pause
