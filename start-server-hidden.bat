@echo off
:: Silent startup script for Farmer Panel Server
:: Runs in background without visible window
cd /d "C:\Users\Administrator\Downloads\farmerpanel"
start /b "" node server.js > nul 2>&1
