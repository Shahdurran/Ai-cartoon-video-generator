@echo off
echo.
echo ========================================
echo  Starting Video Generation System
echo ========================================
echo.
echo Backend API: http://localhost:3000
echo Frontend UI: http://localhost:5173
echo.
echo Starting both servers...
echo ========================================
echo.

REM Start backend in a new window
start "Backend Server" cmd /k "npm start"

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend in a new window
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are starting in separate windows!
echo.
echo Press any key to exit this window...
pause >nul

