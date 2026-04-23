# =============================================================================
# Windows 11 Client Deployment Setup Script
# FFmpeg Video Generator - Automated Installation
# =============================================================================
# 
# This script automates the complete setup of the video generator on Windows 11
# 
# Prerequisites: 
# - Run as Administrator
# - Active internet connection
# - Project already cloned from GitHub
#
# =============================================================================

param(
    [switch]$SkipPrerequisites = $false,
    [switch]$QuickSetup = $false
)

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }
function Write-Step { Write-Host "`n==> $args" -ForegroundColor Magenta }

# Banner
Clear-Host
Write-Info "==============================================================================="
Write-Info "    🚀 FFmpeg Video Generator - Windows 11 Automated Setup"
Write-Info "==============================================================================="
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "⚠️  This script should be run as Administrator for best results."
    Write-Warning "   Right-click PowerShell and select 'Run as Administrator'"
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne 'y') {
        exit 1
    }
}

# Track installation progress
$script:installationLog = @()
$script:errors = @()

function Add-Log {
    param($Message, $Type = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Type] $Message"
    $script:installationLog += $logEntry
    
    if ($Type -eq "ERROR") {
        $script:errors += $Message
    }
}

# =============================================================================
# STEP 1: Check Prerequisites
# =============================================================================

Write-Step "Step 1/9: Checking Prerequisites"

$prerequisites = @{
    Git = $false
    NodeJS = $false
    Docker = $false
    Python = $false
    FFmpeg = $false
}

# Check Git
Write-Info "  Checking Git..."
try {
    $gitVersion = git --version 2>&1
    if ($gitVersion -match "git version") {
        Write-Success "  ✅ Git installed: $gitVersion"
        $prerequisites.Git = $true
        Add-Log "Git found: $gitVersion"
    }
} catch {
    Write-Warning "  ❌ Git not found"
    Add-Log "Git not found" "ERROR"
}

# Check Node.js
Write-Info "  Checking Node.js..."
try {
    $nodeVersion = node --version 2>&1
    $npmVersion = npm --version 2>&1
    if ($nodeVersion -match "v\d+") {
        $version = [int]($nodeVersion -replace 'v(\d+).*', '$1')
        if ($version -ge 18) {
            Write-Success "  ✅ Node.js installed: $nodeVersion (npm $npmVersion)"
            $prerequisites.NodeJS = $true
            Add-Log "Node.js found: $nodeVersion, npm: $npmVersion"
        } else {
            Write-Warning "  ⚠️  Node.js version too old: $nodeVersion (need v18+)"
            Add-Log "Node.js version insufficient: $nodeVersion" "WARNING"
        }
    }
} catch {
    Write-Warning "  ❌ Node.js not found"
    Add-Log "Node.js not found" "ERROR"
}

# Check Docker
Write-Info "  Checking Docker..."
try {
    $dockerVersion = docker --version 2>&1
    if ($dockerVersion -match "Docker version") {
        Write-Success "  ✅ Docker installed: $dockerVersion"
        
        # Check if Docker is running
        $dockerRunning = docker ps 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "  ✅ Docker is running"
            $prerequisites.Docker = $true
            Add-Log "Docker found and running: $dockerVersion"
        } else {
            Write-Warning "  ⚠️  Docker installed but not running"
            Write-Info "     Please start Docker Desktop"
            Add-Log "Docker not running" "WARNING"
        }
    }
} catch {
    Write-Warning "  ❌ Docker not found"
    Add-Log "Docker not found" "ERROR"
}

# Check Python
Write-Info "  Checking Python..."
try {
    $pythonVersion = python --version 2>&1
    if ($pythonVersion -match "Python") {
        Write-Success "  ✅ Python installed: $pythonVersion"
        $prerequisites.Python = $true
        Add-Log "Python found: $pythonVersion"
    }
} catch {
    Write-Warning "  ❌ Python not found"
    Add-Log "Python not found" "ERROR"
}

# Check FFmpeg
Write-Info "  Checking FFmpeg..."
try {
    $ffmpegVersion = ffmpeg -version 2>&1 | Select-Object -First 1
    if ($ffmpegVersion -match "ffmpeg version") {
        Write-Success "  ✅ FFmpeg installed: $ffmpegVersion"
        $prerequisites.FFmpeg = $true
        Add-Log "FFmpeg found: $ffmpegVersion"
    }
} catch {
    Write-Warning "  ❌ FFmpeg not found"
    Add-Log "FFmpeg not found" "ERROR"
}

# Summary of prerequisites
Write-Host ""
$missingCount = ($prerequisites.Values | Where-Object { $_ -eq $false }).Count
if ($missingCount -eq 0) {
    Write-Success "🎉 All prerequisites are installed!"
} else {
    Write-Warning "⚠️  $missingCount prerequisite(s) missing or not properly configured"
}

# Offer to install missing prerequisites
if ($missingCount -gt 0 -and -not $SkipPrerequisites) {
    Write-Host ""
    Write-Info "The following tools need to be installed:"
    
    if (-not $prerequisites.Git) {
        Write-Host "  • Git - https://git-scm.com/download/win"
    }
    if (-not $prerequisites.NodeJS) {
        Write-Host "  • Node.js (v18+) - https://nodejs.org/"
    }
    if (-not $prerequisites.Docker) {
        Write-Host "  • Docker Desktop - https://www.docker.com/products/docker-desktop/"
    }
    if (-not $prerequisites.Python) {
        Write-Host "  • Python (3.8+) - https://www.python.org/downloads/"
    }
    if (-not $prerequisites.FFmpeg) {
        Write-Host "  • FFmpeg - Will attempt automatic installation"
    }
    
    Write-Host ""
    $installChoice = Read-Host "Do you want to install missing tools automatically where possible? (y/n)"
    
    if ($installChoice -eq 'y') {
        # Try to install FFmpeg automatically
        if (-not $prerequisites.FFmpeg) {
            Write-Step "Installing FFmpeg..."
            
            # Try WinGet first
            $wingetPath = Get-Command winget -ErrorAction SilentlyContinue
            if ($wingetPath) {
                Write-Info "  Installing via WinGet..."
                winget install --id=Gyan.FFmpeg -e --silent
                
                # Refresh environment
                $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
                
                # Check if successful
                try {
                    $ffmpegCheck = ffmpeg -version 2>&1
                    if ($ffmpegCheck -match "ffmpeg version") {
                        Write-Success "  ✅ FFmpeg installed successfully!"
                        $prerequisites.FFmpeg = $true
                    }
                } catch {
                    Write-Warning "  ⚠️  FFmpeg installation may require PowerShell restart"
                }
            } else {
                Write-Warning "  WinGet not available. Please install FFmpeg manually."
                Write-Info "  Run: .\install-ffmpeg.ps1"
            }
        }
        
        # For other missing tools, provide guidance
        if (-not $prerequisites.Git -or -not $prerequisites.NodeJS -or -not $prerequisites.Docker -or -not $prerequisites.Python) {
            Write-Host ""
            Write-Warning "⚠️  Please install the remaining tools manually, then run this script again."
            Write-Info "   See: WINDOWS_11_CLIENT_DEPLOYMENT_GUIDE.md for detailed instructions"
            
            $continueAnyway = Read-Host "Continue with partial setup? (y/n)"
            if ($continueAnyway -ne 'y') {
                exit 1
            }
        }
    }
}

# =============================================================================
# STEP 2: Create Directory Structure
# =============================================================================

Write-Step "Step 2/9: Creating Directory Structure"

$directories = @(
    "output",
    "temp",
    "storage",
    "storage/channels",
    "storage/batches",
    "storage/sessions",
    "public/videos",
    "test-output",
    "video-bank",
    "music-library",
    "person-videos",
    "sound-waves",
    "public/person-videos",
    "public/sound-waves",
    "storage/generated-assets"
)

foreach ($dir in $directories) {
    try {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
            Write-Info "  Created: $dir"
            Add-Log "Created directory: $dir"
        } else {
            Write-Info "  Exists: $dir"
        }
    } catch {
        Write-Warning "  ⚠️  Failed to create: $dir"
        Add-Log "Failed to create directory: $dir" "ERROR"
    }
}

Write-Success "✅ Directory structure created"

# =============================================================================
# STEP 3: Install Node.js Dependencies (Backend)
# =============================================================================

Write-Step "Step 3/9: Installing Backend Dependencies"

if ($prerequisites.NodeJS) {
    Write-Info "  Running npm install..."
    
    try {
        npm install
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "✅ Backend dependencies installed"
            Add-Log "Backend dependencies installed successfully"
        } else {
            Write-Warning "⚠️  Some packages may have failed to install"
            Add-Log "Backend npm install had warnings" "WARNING"
        }
    } catch {
        Write-Error "❌ Failed to install backend dependencies"
        Add-Log "Backend npm install failed" "ERROR"
        $script:errors += "Backend npm install failed: $_"
    }
} else {
    Write-Warning "⚠️  Skipping (Node.js not available)"
    Add-Log "Skipped backend install - Node.js not available" "WARNING"
}

# =============================================================================
# STEP 4: Install Node.js Dependencies (Frontend)
# =============================================================================

Write-Step "Step 4/9: Installing Frontend Dependencies"

if ($prerequisites.NodeJS -and (Test-Path "frontend")) {
    Write-Info "  Running npm install in frontend..."
    
    try {
        Push-Location frontend
        npm install
        Pop-Location
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "✅ Frontend dependencies installed"
            Add-Log "Frontend dependencies installed successfully"
        } else {
            Write-Warning "⚠️  Some packages may have failed to install"
            Add-Log "Frontend npm install had warnings" "WARNING"
        }
    } catch {
        Pop-Location
        Write-Error "❌ Failed to install frontend dependencies"
        Add-Log "Frontend npm install failed" "ERROR"
        $script:errors += "Frontend npm install failed: $_"
    }
} else {
    if (-not (Test-Path "frontend")) {
        Write-Warning "⚠️  Frontend directory not found"
        Add-Log "Frontend directory not found" "WARNING"
    } else {
        Write-Warning "⚠️  Skipping (Node.js not available)"
        Add-Log "Skipped frontend install - Node.js not available" "WARNING"
    }
}

# =============================================================================
# STEP 5: Setup Docker Redis Container
# =============================================================================

Write-Step "Step 5/9: Setting Up Redis Container"

if ($prerequisites.Docker) {
    Write-Info "  Checking for existing Redis container..."
    
    $existingContainer = docker ps -a --filter "name=redis-video-gen" --format "{{.Names}}" 2>&1
    
    if ($existingContainer -eq "redis-video-gen") {
        Write-Info "  Redis container already exists"
        
        # Check if running
        $containerStatus = docker ps --filter "name=redis-video-gen" --format "{{.Status}}" 2>&1
        
        if ($containerStatus -match "Up") {
            Write-Success "  ✅ Redis container is already running"
            Add-Log "Redis container already running"
        } else {
            Write-Info "  Starting existing Redis container..."
            docker start redis-video-gen
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "  ✅ Redis container started"
                Add-Log "Started existing Redis container"
            } else {
                Write-Error "  ❌ Failed to start Redis container"
                Add-Log "Failed to start Redis container" "ERROR"
            }
        }
    } else {
        Write-Info "  Creating new Redis container..."
        docker run -d --name redis-video-gen -p 6379:6379 redis:alpine
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "  ✅ Redis container created and started"
            Add-Log "Created and started new Redis container"
            
            # Wait for Redis to be ready
            Write-Info "  Waiting for Redis to be ready..."
            Start-Sleep -Seconds 3
            
            # Test connection
            $redisPing = docker exec redis-video-gen redis-cli ping 2>&1
            if ($redisPing -eq "PONG") {
                Write-Success "  ✅ Redis is responding"
                Add-Log "Redis connection verified"
            } else {
                Write-Warning "  ⚠️  Redis may not be fully ready yet"
                Add-Log "Redis connection test inconclusive" "WARNING"
            }
        } else {
            Write-Error "  ❌ Failed to create Redis container"
            Add-Log "Failed to create Redis container" "ERROR"
        }
    }
} else {
    Write-Warning "⚠️  Skipping (Docker not available)"
    Add-Log "Skipped Redis setup - Docker not available" "WARNING"
}

# =============================================================================
# STEP 6: Setup Python Virtual Environment & Whisper
# =============================================================================

Write-Step "Step 6/9: Setting Up Python Environment & Whisper"

if ($prerequisites.Python) {
    if (-not (Test-Path "whisper-venv")) {
        Write-Info "  Creating Python virtual environment..."
        
        try {
            python -m venv whisper-venv
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "  ✅ Virtual environment created"
                Add-Log "Python virtual environment created"
            } else {
                Write-Error "  ❌ Failed to create virtual environment"
                Add-Log "Failed to create Python venv" "ERROR"
            }
        } catch {
            Write-Error "  ❌ Error creating virtual environment: $_"
            Add-Log "Python venv creation error: $_" "ERROR"
        }
    } else {
        Write-Info "  Virtual environment already exists"
    }
    
    # Install Whisper
    Write-Info "  Installing OpenAI Whisper..."
    Write-Info "  (This may take several minutes...)"
    
    try {
        & ".\whisper-venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
        & ".\whisper-venv\Scripts\python.exe" -m pip install openai-whisper --quiet
        & ".\whisper-venv\Scripts\python.exe" -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu --quiet
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "  ✅ Whisper installed successfully"
            Add-Log "Whisper installed successfully"
        } else {
            Write-Warning "  ⚠️  Whisper installation may have had issues"
            Add-Log "Whisper installation warnings" "WARNING"
        }
    } catch {
        Write-Error "  ❌ Failed to install Whisper: $_"
        Add-Log "Whisper installation failed: $_" "ERROR"
    }
} else {
    Write-Warning "⚠️  Skipping (Python not available)"
    Add-Log "Skipped Whisper setup - Python not available" "WARNING"
}

# =============================================================================
# STEP 7: Create .env Configuration File
# =============================================================================

Write-Step "Step 7/9: Creating .env Configuration File"

if (-not (Test-Path ".env")) {
    Write-Info "  Creating .env file..."
    
    $envContent = @"
# Server Configuration
PORT=3000
NODE_ENV=production

# Redis Configuration (Docker container)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# API Keys - UPDATE THESE WITH YOUR ACTUAL KEYS
ANTHROPIC_API_KEY=your_claude_api_key_here
FAL_AI_API_KEY=your_fal_ai_key_here
GENAIPRO_API_KEY=your_genaipro_key_here
ASSEMBLYAI_API_KEY=your_assemblyai_key_here

# FFmpeg Configuration
FFMPEG_PATH=ffmpeg
FFMPEG_THREADS=4

# Path Configuration
VIDEO_BANK_PATH=./video-bank
OUTPUT_PATH=./output
TEMP_PATH=./temp
STORAGE_PATH=./storage

# Queue Configuration
QUEUE_SCRIPT_CONCURRENCY=3
QUEUE_VOICE_CONCURRENCY=2
QUEUE_IMAGE_CONCURRENCY=2
QUEUE_VIDEO_CONCURRENCY=1
QUEUE_JOB_TIMEOUT=300000
QUEUE_MAX_CONCURRENT_JOBS=3
QUEUE_JOB_ATTEMPTS=3

# Batch Processing
BATCH_SIZE=10
BATCH_CONCURRENCY=2

# Google Fonts API (optional)
GOOGLE_FONTS_API_KEY=
"@
    
    try {
        $envContent | Out-File -FilePath ".env" -Encoding UTF8
        Write-Success "✅ .env file created"
        Write-Warning "⚠️  IMPORTANT: Update the API keys in .env file before starting the server!"
        Add-Log ".env file created"
    } catch {
        Write-Error "❌ Failed to create .env file: $_"
        Add-Log "Failed to create .env file: $_" "ERROR"
    }
} else {
    Write-Info "  .env file already exists"
    Write-Warning "  Keeping existing .env file (not overwriting)"
    Add-Log ".env file already exists - not overwritten"
}

# =============================================================================
# STEP 8: Verify Installation
# =============================================================================

Write-Step "Step 8/9: Verifying Installation"

$verificationResults = @{
    Directories = $false
    BackendDeps = $false
    FrontendDeps = $false
    Redis = $false
    Whisper = $false
    EnvFile = $false
}

# Check directories
$verificationResults.Directories = (Test-Path "output") -and (Test-Path "temp") -and (Test-Path "storage")

# Check backend node_modules
$verificationResults.BackendDeps = Test-Path "node_modules"

# Check frontend node_modules
$verificationResults.FrontendDeps = Test-Path "frontend/node_modules"

# Check Redis
try {
    $redisCheck = docker exec redis-video-gen redis-cli ping 2>&1
    $verificationResults.Redis = ($redisCheck -eq "PONG")
} catch {
    $verificationResults.Redis = $false
}

# Check Whisper
$verificationResults.Whisper = Test-Path "whisper-venv"

# Check .env
$verificationResults.EnvFile = Test-Path ".env"

# Display results
Write-Host ""
Write-Info "Installation Verification Results:"
Write-Host ""

foreach ($check in $verificationResults.GetEnumerator()) {
    $status = if ($check.Value) { "✅" } else { "❌" }
    $color = if ($check.Value) { "Green" } else { "Red" }
    Write-Host "  $status " -NoNewline -ForegroundColor $color
    Write-Host $check.Key
}

$successCount = ($verificationResults.Values | Where-Object { $_ -eq $true }).Count
$totalChecks = $verificationResults.Count

Write-Host ""
if ($successCount -eq $totalChecks) {
    Write-Success "🎉 Installation verification passed ($successCount/$totalChecks)"
} else {
    Write-Warning "⚠️  Installation partially complete ($successCount/$totalChecks)"
}

# =============================================================================
# STEP 9: Final Instructions
# =============================================================================

Write-Step "Step 9/9: Final Setup Instructions"

Write-Host ""
Write-Info "═══════════════════════════════════════════════════════════════"
Write-Info "                    Setup Complete!"
Write-Info "═══════════════════════════════════════════════════════════════"
Write-Host ""

if ($script:errors.Count -gt 0) {
    Write-Warning "⚠️  Setup completed with $($script:errors.Count) error(s):"
    foreach ($error in $script:errors) {
        Write-Host "   • $error" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Info "📝 Next Steps:"
Write-Host ""
Write-Host "  1. Update API keys in .env file:" -ForegroundColor White
Write-Host "     notepad .env" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Add your actual API keys for:" -ForegroundColor White
Write-Host "     • ANTHROPIC_API_KEY" -ForegroundColor Gray
Write-Host "     • FAL_AI_API_KEY" -ForegroundColor Gray
Write-Host "     • GENAIPRO_API_KEY" -ForegroundColor Gray
Write-Host "     • ASSEMBLYAI_API_KEY" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Start the application:" -ForegroundColor White
Write-Host "     .\start-both.bat" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. Access the application:" -ForegroundColor White
Write-Host "     Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "     Backend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  5. Run tests (optional):" -ForegroundColor White
Write-Host "     npm run test:pipeline" -ForegroundColor Gray
Write-Host ""

Write-Info "═══════════════════════════════════════════════════════════════"
Write-Info "📚 Documentation:"
Write-Host "   • WINDOWS_11_CLIENT_DEPLOYMENT_GUIDE.md - Complete guide"
Write-Host "   • QUICK_START_TESTING.md - Testing guide"
Write-Host "   • DASHBOARD_USAGE_GUIDE.md - How to use the UI"
Write-Info "═══════════════════════════════════════════════════════════════"
Write-Host ""

# Save installation log
$logPath = "installation-log.txt"
$script:installationLog | Out-File -FilePath $logPath -Encoding UTF8
Write-Info "📄 Installation log saved to: $logPath"
Write-Host ""

Write-Success "✅ Setup script completed!"
Write-Host ""

# Offer to open .env file
$openEnv = Read-Host "Would you like to open .env file now to add API keys? (y/n)"
if ($openEnv -eq 'y') {
    notepad .env
}

Write-Host ""
Write-Info "Thank you for using FFmpeg Video Generator!"
Write-Host ""


