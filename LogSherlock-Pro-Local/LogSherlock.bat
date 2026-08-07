@echo off
title LogSherlock Pro
echo.
echo  ========================================
echo   LogSherlock Pro - Starting...
echo  ========================================
echo.

cd /d "%~dp0"

:: Check if Python is available
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found. Install Python 3.10+ from python.org
    pause
    exit /b 1
)

:: Open browser after 1 second
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8888"

:: Start server
echo  Server running at: http://localhost:8888
echo  Press Ctrl+C to stop
echo.
python server.py
