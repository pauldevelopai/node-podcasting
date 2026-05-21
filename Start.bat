@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies (first run only) - this takes about a minute...
  call npm install
)
REM Push usage stats from previous sessions to the GROUNDED dashboard
REM (metadata only - never your audio, transcripts, or keys). Best-effort.
call sync-telemetry.bat
start "" http://localhost:3000
npm start
REM App has stopped - sync this session's stats too.
call sync-telemetry.bat
pause
