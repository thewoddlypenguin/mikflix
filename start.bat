@echo off
REM Mikflix — dev server
REM APP_PORT is provided by the environment; falls back to 5173.
if "%APP_PORT%"=="" set APP_PORT=5173
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run dev