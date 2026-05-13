@echo off
echo.
echo ========================================
echo  AI Cartoon Generator (API + Web)
echo ========================================
echo.
echo Backend API: http://localhost:4000
echo Next.js app: http://localhost:3001  (set NEXT_PUBLIC_API_URL=http://localhost:4000 in web\.env.local)
echo.
echo Starting both servers...
echo ========================================
echo.

start "Cartoon API" cmd /k "cd /d %~dp0 && npm start"

timeout /t 3 /nobreak >nul

start "Next.js web" cmd /k "cd /d %~dp0web && set NEXT_PUBLIC_API_URL=http://localhost:4000&& npx next dev -p 3001"

echo.
echo Both servers are starting in separate windows.
echo.
pause >nul
