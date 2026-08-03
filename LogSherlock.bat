@echo off
title LogSherlock Pro - Local Server
color 0A

echo.
echo  ========================================
echo   LogSherlock Pro v1.0.0
echo   HPE VME Log Analysis Suite
echo   (c) 2026 Krishna Yada
echo  ========================================
echo.
echo  Starting local server...
echo  Your data never leaves this machine.
echo.

:: Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python not found! Install Python 3.10+ from python.org
    pause
    exit /b 1
)

:: Check if requirements are installed
python -c "import flask" >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Installing dependencies...
    pip install -r requirements.txt
)

:: Set dev mode
set LOGSHERLOCK_DEV_MODE=true

:: Start server
echo.
echo  [OK] Server starting on http://localhost:5000
echo  [OK] Press Ctrl+C to stop
echo.
echo  Opening browser...
timeout /t 2 >nul
start http://localhost:5000

python app.py
