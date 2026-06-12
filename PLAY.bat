@echo off
REM ============================================================
REM  Aetheria - one-click launcher (portable, any drive letter)
REM ============================================================
title Aetheria Game Server
cd /d "%~dp0"

echo.
echo   ====================================
echo    AETHERIA - Top-Down Adventure
echo   ====================================
echo.

REM --- find a python: prefer bundled Hermes runtime, else system python ---
set "PY="
if exist "%~dp0..\..\.cache\runtimes\windows-x64\python\python.exe" set "PY=%~dp0..\..\.cache\runtimes\windows-x64\python\python.exe"
if not defined PY (where python >nul 2>&1 && set "PY=python")
if not defined PY (where py >nul 2>&1 && set "PY=py")
if not defined PY (
    echo  [ERROR] No Python found. See README for the Node / VS Code method.
    pause
    exit /b 1
)

REM --- free port 8777 if a stale server is hogging it ---
echo  Clearing port 8777 if already in use...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :8777 ^| findstr LISTENING') do taskkill /F /PID %%P >nul 2>&1

echo  Starting server...
echo  Opening http://localhost:8777 in your browser...
echo.
echo  ^>^> Leave THIS window OPEN while playing. ^<^<
echo  ^>^> Close it (or Ctrl+C) to stop the game.  ^<^<
echo.

start "" cmd /c "timeout /t 2 >nul & start http://localhost:8777"
"%PY%" -m http.server 8777
