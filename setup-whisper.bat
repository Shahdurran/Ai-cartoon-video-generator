@echo off
echo ========================================
echo Setting up Whisper for Node.js project
echo ========================================

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ and try again
    pause
    exit /b 1
)

REM Create virtual environment if it doesn't exist
if not exist "whisper-venv" (
    echo Creating virtual environment...
    python -m venv whisper-venv
    if %errorlevel% neq 0 (
        echo ERROR: Failed to create virtual environment
        pause
        exit /b 1
    )
)

REM Activate virtual environment
echo Activating virtual environment...
CALL whisper-venv\Scripts\activate.bat

REM Upgrade pip and install setuptools wheel
echo Upgrading pip and dependencies...
python -m pip install --upgrade pip setuptools wheel

REM Install openai-whisper (more stable than faster-whisper)
echo Installing OpenAI Whisper...
pip install openai-whisper

REM Install additional dependencies that might be needed
echo Installing additional dependencies...
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

REM Test installation
echo Testing Whisper installation...
python -c "import whisper; print('OpenAI Whisper installed successfully!')" || (
    echo ERROR: Whisper installation failed
    pause
    exit /b 1
)

REM List available models
echo Available Whisper models:
python -c "import whisper; print('\n'.join(whisper.available_models()))"

echo.
echo ========================================
echo Setup completed successfully!
echo ========================================
echo.
echo Now you can test with: node test-whisper.js
echo.
pause