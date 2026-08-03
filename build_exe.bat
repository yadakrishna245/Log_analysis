@echo off
title Building LogSherlock Pro .exe
color 0E

echo.
echo  ========================================
echo   Building LogSherlock Pro as .exe
echo  ========================================
echo.

:: Check PyInstaller
python -c "import PyInstaller" >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Installing PyInstaller...
    pip install pyinstaller
)

echo [*] Building executable...
echo     This may take 2-3 minutes...
echo.

pyinstaller --onefile ^
    --name "LogSherlock-Pro" ^
    --icon "NONE" ^
    --add-data "templates;templates" ^
    --add-data "static;static" ^
    --add-data "engine;engine" ^
    --add-data "knowledge;knowledge" ^
    --add-data "routes;routes" ^
    --add-data "services;services" ^
    --hidden-import "flask" ^
    --hidden-import "flask_sqlalchemy" ^
    --hidden-import "sqlalchemy" ^
    --hidden-import "jinja2" ^
    --hidden-import "werkzeug" ^
    --hidden-import "click" ^
    run_exe.py

if %errorlevel% equ 0 (
    echo.
    echo  ========================================
    echo   SUCCESS! .exe created at:
    echo   dist\LogSherlock-Pro.exe
    echo  ========================================
    echo.
    echo  Share this single file with your team.
    echo  Double-click to run - no Python needed!
) else (
    echo.
    echo  [ERROR] Build failed. Check errors above.
)

pause
