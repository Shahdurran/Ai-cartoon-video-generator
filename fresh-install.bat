@echo off
echo ========================================
echo Complete Whisper Installation Script
echo (OpenAI Whisper + Faster Whisper)
echo ========================================

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.9 or higher and try again
    pause
    exit /b 1
)

echo Current Python version:
python --version

REM Remove existing virtual environment
if exist "whisper-venv" (
    echo Removing existing virtual environment...
    rmdir /s /q "whisper-venv"
)

REM Create fresh virtual environment
echo Creating fresh virtual environment...
python -m venv whisper-venv
if %errorlevel% neq 0 (
    echo ERROR: Failed to create virtual environment
    pause
    exit /b 1
)

REM Activate virtual environment
echo Activating virtual environment...
CALL whisper-venv\Scripts\activate.bat

REM Upgrade pip first
echo Upgrading pip...
python -m pip install --upgrade pip

REM Install PyTorch (CPU version)
echo Installing PyTorch (CPU version)...
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

REM Test PyTorch
echo Testing PyTorch...
python -c "import torch; print('PyTorch version:', torch.__version__)"
if %errorlevel% neq 0 (
    echo ERROR: PyTorch installation failed
    pause
    exit /b 1
)

REM Install faster-whisper (optimized version)
echo Installing faster-whisper...
pip install faster-whisper

REM Install openai-whisper (original version)
echo Installing openai-whisper...
pip install openai-whisper

REM Install additional useful packages
echo Installing additional packages...
pip install ffmpeg-python

REM Test both Whisper installations
echo.
echo Testing faster-whisper...
python -c "import faster_whisper; print('faster-whisper installed successfully')"

echo Testing openai-whisper...
python -c "import whisper; print('openai-whisper installed successfully')"

echo.
echo ========================================
echo Installation completed successfully!
echo ========================================
echo.
echo Installed packages:
pip list | findstr /i "torch whisper ffmpeg"
echo.
echo Available models for openai-whisper:
python -c "import whisper; print(whisper.available_models())"
echo.
echo Virtual environment activated. You can now use both Whisper implementations!
echo.
echo To use in the future:
echo 1. Activate: whisper-venv\Scripts\activate.bat
echo 2. For faster-whisper: python -m faster_whisper audio.wav --model base
echo 3. For openai-whisper: python -m whisper audio.wav --model base
echo.
pause