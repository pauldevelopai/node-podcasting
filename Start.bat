@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies (first run only) - this takes about a minute...
  call npm install
)
start "" http://localhost:3000
npm start
pause
