@echo off
cd /d "%~dp0"
echo Fetching the latest version...
git pull origin main
echo Updating dependencies...
call npm install
echo.
echo   Update complete. Run Start.bat to launch the app.
pause
