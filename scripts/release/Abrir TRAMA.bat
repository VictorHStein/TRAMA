@echo off
rem Opens the prebuilt TRAMA with the server built into Windows (no Node.js needed).
chcp 65001 >nul
cd /d "%~dp0"
title TRAMA
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor-estatico.ps1"
if errorlevel 1 pause
