# LogSherlock Pro - Ollama AI Setup Script (Windows)
# Run this script once to enable local AI features
# Your data never leaves your machine.

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  LogSherlock Pro - AI Setup (Ollama)" -ForegroundColor Green  
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if Ollama is installed
$ollamaPath = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollamaPath) {
    Write-Host "[!] Ollama not found. Please install it first:" -ForegroundColor Yellow
    Write-Host "    Download: https://ollama.com/download/windows" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "    After installing, run this script again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[OK] Ollama is installed" -ForegroundColor Green

# Check available RAM
$totalRAM = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
Write-Host "[OK] System RAM: ${totalRAM}GB" -ForegroundColor Green

# Select model based on RAM
if ($totalRAM -ge 32) {
    $model = "qwen3.5:9b"
    Write-Host "[*] Recommended model for ${totalRAM}GB RAM: $model (best accuracy)" -ForegroundColor Cyan
} elseif ($totalRAM -ge 16) {
    $model = "qwen3.5:4b"
    Write-Host "[*] Recommended model for ${totalRAM}GB RAM: $model (excellent accuracy)" -ForegroundColor Cyan
} else {
    $model = "llama3.2:1b"
    Write-Host "[*] Recommended model for ${totalRAM}GB RAM: $model (good, lightweight)" -ForegroundColor Cyan
}

Write-Host ""
$confirm = Read-Host "Pull model '$model'? (Y/n)"
if ($confirm -eq 'n' -or $confirm -eq 'N') {
    Write-Host "Skipped. You can manually run: ollama pull <model>" -ForegroundColor Yellow
    exit 0
}

# Pull the model
Write-Host ""
Write-Host "[*] Downloading $model ... (this may take 2-5 minutes)" -ForegroundColor Cyan
ollama pull $model

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  SUCCESS! AI is ready." -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor White
    Write-Host "  1. Open Edge/Chrome" -ForegroundColor White
    Write-Host "  2. Go to: edge://flags/#unsafely-treat-insecure-origin-as-secure" -ForegroundColor Cyan
    Write-Host "     (or chrome://flags/#unsafely-treat-insecure-origin-as-secure)" -ForegroundColor Cyan
    Write-Host "  3. Add: http://localhost:11434" -ForegroundColor Cyan
    Write-Host "  4. Set to 'Enabled' -> Relaunch browser" -ForegroundColor White
    Write-Host "  5. Open: https://d3tv1czat55yad.cloudfront.net" -ForegroundColor Cyan
    Write-Host "  6. The robot icon should show GREEN dot" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Features:" -ForegroundColor White
    Write-Host "  - 156 detection patterns (kernel, storage, cluster, VME services)" -ForegroundColor White
    Write-Host "  - Streaming engine: handles files up to 3GB+" -ForegroundColor White
    Write-Host "  - Multi-file scan: drop 30+ files at once" -ForegroundColor White
    Write-Host "  - AI-powered root cause analysis (local, private)" -ForegroundColor White
    Write-Host "  - Jira integration with comment posting" -ForegroundColor White
    Write-Host ""
    Write-Host "  Your data NEVER leaves your machine!" -ForegroundColor Yellow
} else {
    Write-Host "[ERROR] Failed to pull model. Check your internet connection." -ForegroundColor Red
}

Write-Host ""
Read-Host "Press Enter to exit"
