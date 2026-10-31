
@echo off
setlocal EnableExtensions
title SentinelAI Launcher
color 0B

REM ==========================================
REM SENTINEL AI - ONE CLICK LAUNCHER
REM ==========================================

cd /d "%~dp0"

echo ==========================================
echo           SENTINEL AI LAUNCHER
echo ==========================================
echo.

REM Step 1 - Check virtual environment

if not exist ".venv\Scripts\activate.bat" (
    echo [ERROR] Virtual environment not found.
    echo Expected: .venv\Scripts\activate.bat
    pause
    exit /b 1
)

echo [OK] Virtual environment found.

REM Step 2 - Check ML model

if not exist "sentinel_model.json" (
    echo [ERROR] Trained ML model not found.
    pause
    exit /b 1
)

echo [OK] XGBoost model found.

REM Step 3 - Check dashboard

if not exist "dashboard\index.html" (
    echo [ERROR] Dashboard file not found.
    echo Expected: dashboard\index.html
    pause
    exit /b 1
)

echo [OK] Dashboard found.
echo.

REM Step 4 - Check if backend is already running

echo [INFO] Checking FastAPI backend...

call :CHECK_BACKEND

if not errorlevel 1 (
    echo [OK] Backend is already running.
    goto OPEN_DASHBOARD
)

REM Step 5 - Start backend using working command

echo [INFO] Starting SentinelAI backend...

start "SentinelAI Backend" cmd /k "call .venv\Scripts\activate.bat && python -m uvicorn main:app --reload --port 8000"

REM Step 6 - Wait for backend to respond

echo [INFO] Waiting for backend startup...

for /L %%i in (1,1,30) do (
    call :CHECK_BACKEND

    if not errorlevel 1 goto OPEN_DASHBOARD

    timeout /t 2 /nobreak >nul
)

echo.
echo [ERROR] Backend did not start within the expected time.
echo Check the SentinelAI Backend terminal.
pause
exit /b 1

REM Step 7 - Open dashboard in Microsoft Edge

:OPEN_DASHBOARD

echo.
echo ==========================================
echo        SENTINEL AI BACKEND READY
echo ==========================================
echo.

echo [INFO] Opening SentinelAI Dashboard...

set "DASHBOARD=%CD%\dashboard\index.html"

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%DASHBOARD%"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" "%DASHBOARD%"
) else (
    start "" "microsoft-edge:%DASHBOARD%"
)

echo.
echo ==========================================
echo          SENTINEL AI IS ACTIVE
echo ==========================================
echo.
echo Backend: http://127.0.0.1:8000
echo API Docs: http://127.0.0.1:8000/docs
echo Dashboard: dashboard\index.html
echo Browser: Microsoft Edge
echo.
echo Keep the backend terminal running.
echo.

pause
exit /b 0

REM ==========================================
REM FUNCTION - Check backend readiness
REM ==========================================

:CHECK_BACKEND

powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/docs' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"

exit /b %errorlevel%
