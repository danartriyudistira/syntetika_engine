@echo off
setlocal

cd /d "%~dp0"
set "OSC_BRIDGE_HOST=127.0.0.1"
set "OSC_BRIDGE_PORT=8765"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js tidak ditemukan.
    pause
    exit /b 1
)

title Syntetika Engine OSC Bridge
echo Starting Syntetika Engine OSC Bridge...
echo URL : http://%OSC_BRIDGE_HOST%:%OSC_BRIDGE_PORT%/osc
echo.
echo Tutup window ini untuk menghentikan OSC bridge.
echo.

node osc-bridge.js

pause
