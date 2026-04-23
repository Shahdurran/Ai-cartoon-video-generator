# FFmpeg Installation Script for Windows
# This script downloads and installs FFmpeg

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   FFmpeg Installation for Video Generator" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠️  This script should be run as Administrator for best results." -ForegroundColor Yellow
    Write-Host "   Right-click PowerShell and select 'Run as Administrator'`n" -ForegroundColor Yellow
}

# Option 1: Try WinGet (Windows 10 1809+ / Windows 11)
Write-Host "Checking for WinGet..." -ForegroundColor Yellow
$wingetPath = Get-Command winget -ErrorAction SilentlyContinue

if ($wingetPath) {
    Write-Host "✅ WinGet found! Installing FFmpeg via WinGet...`n" -ForegroundColor Green
    winget install --id=Gyan.FFmpeg -e
    
    Write-Host "`n✅ FFmpeg installed!" -ForegroundColor Green
    Write-Host "⚠️  Please restart your terminal/PowerShell for changes to take effect.`n" -ForegroundColor Yellow
    
} else {
    Write-Host "❌ WinGet not found. Trying Chocolatey...`n" -ForegroundColor Red
    
    # Option 2: Try Chocolatey
    $chocoPath = Get-Command choco -ErrorAction SilentlyContinue
    
    if ($chocoPath) {
        Write-Host "✅ Chocolatey found! Installing FFmpeg via Chocolatey...`n" -ForegroundColor Green
        choco install ffmpeg -y
        
        Write-Host "`n✅ FFmpeg installed!" -ForegroundColor Green
        Write-Host "⚠️  Please restart your terminal/PowerShell for changes to take effect.`n" -ForegroundColor Yellow
        
    } else {
        Write-Host "❌ Chocolatey not found. Manual installation required.`n" -ForegroundColor Red
        
        Write-Host "📥 MANUAL INSTALLATION INSTRUCTIONS:" -ForegroundColor Cyan
        Write-Host "================================`n" -ForegroundColor Cyan
        
        Write-Host "1. Download FFmpeg:" -ForegroundColor White
        Write-Host "   Go to: https://www.gyan.dev/ffmpeg/builds/`n" -ForegroundColor Gray
        
        Write-Host "2. Download the 'ffmpeg-release-full.7z' file`n" -ForegroundColor White
        
        Write-Host "3. Extract to: C:\ffmpeg`n" -ForegroundColor White
        
        Write-Host "4. Add to PATH:" -ForegroundColor White
        Write-Host "   a. Open 'Edit the system environment variables'" -ForegroundColor Gray
        Write-Host "   b. Click 'Environment Variables'" -ForegroundColor Gray
        Write-Host "   c. Under 'System variables', find 'Path'" -ForegroundColor Gray
        Write-Host "   d. Click 'Edit' then 'New'" -ForegroundColor Gray
        Write-Host "   e. Add: C:\ffmpeg\bin" -ForegroundColor Gray
        Write-Host "   f. Click OK on all windows`n" -ForegroundColor Gray
        
        Write-Host "5. Restart PowerShell and verify:" -ForegroundColor White
        Write-Host "   ffmpeg -version`n" -ForegroundColor Gray
        
        Write-Host "-----------------------------------------------`n" -ForegroundColor DarkGray
        
        Write-Host "Alternative: Install Chocolatey first, then FFmpeg:" -ForegroundColor Yellow
        Write-Host "   https://chocolatey.org/install`n" -ForegroundColor Gray
    }
}

# Verify installation
Write-Host "Verifying FFmpeg installation..." -ForegroundColor Yellow
$ffmpegCheck = Get-Command ffmpeg -ErrorAction SilentlyContinue

if ($ffmpegCheck) {
    Write-Host "✅ FFmpeg is installed and in PATH!" -ForegroundColor Green
    Write-Host "`nFFmpeg version:" -ForegroundColor Cyan
    ffmpeg -version | Select-Object -First 1
    Write-Host "`n✅ You can now run: npm run test:pipeline" -ForegroundColor Green
} else {
    Write-Host "⚠️  FFmpeg not detected in PATH yet." -ForegroundColor Yellow
    Write-Host "   If you just installed it, restart PowerShell and try again.`n" -ForegroundColor Yellow
}

Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host "For help, see: SYSTEM-STATUS-AND-NEXT-STEPS.md" -ForegroundColor Cyan
Write-Host "===============================================`n" -ForegroundColor Cyan

