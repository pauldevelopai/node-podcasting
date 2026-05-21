@echo off
cd /d "%~dp0"
REM First, push any local usage stats so they're not lost during the update.
call sync-telemetry.bat
echo Fetching the latest version...
call git pull origin main
echo Updating dependencies...
call npm install
echo.
echo   Update complete. Run Start.bat to launch the app.
pause
