@echo off
title PoE Guide - Local Server
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js and npm are needed to run the site.
  echo Install Node.js, then double-click this file again.
  pause
  exit /b 1
)

if not exist "node_modules\astro" (
  echo Installing project dependencies...
  call npm ci
  if errorlevel 1 goto failed
)

echo Starting the PoE guide and local save server...
echo Open the address shown below in your browser. Keep this window open while using the site.
echo.
call npm run dev
if errorlevel 1 goto failed

echo.
echo Server stopped.
pause
exit /b 0

:failed
echo.
echo The server could not start. Read the error above for details.
pause
exit /b 1
