@echo off
title Farmer Panel Server
cd /d "%~dp0"
echo Starting Farmer Panel Server...
echo.
node server.js
pause
