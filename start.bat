@echo off
chcp 65001 >nul
title Network Config Generator

echo ========================================
echo   Network Config Generator v1.0
echo ========================================
echo.

cd /d "%~dp0backend"

:: Check .env
if not exist ".env" (
    echo [WARNING] .env not found, please configure DEEPSEEK_API_KEY
)

:: Check dist
if not exist "..\frontend\dist\index.html" (
    echo [INFO] Building frontend...
    cd /d "%~dp0frontend"
    call npx vite build
    cd /d "%~dp0backend"
)

echo [INFO] Starting server on http://localhost:5732 ...
echo [INFO] Press Ctrl+C to stop
echo.

start "" http://localhost:5732

python main.py

pause
