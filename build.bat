@echo off
chcp 65001 >nul
title 构建前端

echo [INFO] 正在构建前端...
cd /d "%~dp0frontend"
call npx vite build
echo.
echo [DONE] 构建完成，dist 目录已生成。
echo [INFO] 双击 start.bat 启动服务。
pause
