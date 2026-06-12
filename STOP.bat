@echo off
title Stop Aetheria Server
echo Stopping any server on port 8777...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :8777 ^| findstr LISTENING') do taskkill /F /PID %%P >nul 2>&1
echo Done.
timeout /t 2 >nul
