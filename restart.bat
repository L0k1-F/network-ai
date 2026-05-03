@echo off
chcp 65001 >nul
title Restart Network Config Generator

echo ========================================
echo   Restarting Network Config Generator
echo ========================================
echo.

:: Kill existing backend process
echo [1/3] Stopping backend...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5732" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1 && echo [OK] Backend stopped (PID %%a)
)
:: Give the port a moment to release
timeout /t 1 /nobreak >nul

cd /d "%~dp0backend"

:: Check .env
if not exist ".env" (
    echo [WARNING] .env not found, please configure API keys
)

:: Rebuild frontend
echo.
echo [2/3] Rebuilding frontend...
cd /d "%~dp0frontend"
call npx vite build
cd /d "%~dp0backend"

:: Start backend
echo.
echo [3/3] Starting server on http://localhost:5732 ...
start "" http://localhost:5732
python main.py

pause
