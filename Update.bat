@echo off
REM Double-click this to update Podcast Studio to the latest version.
REM
REM How updating works: your own usage stats live in YOUR copy on GitHub (origin).
REM The app's code updates come from the canonical repo (upstream). This pulls the
REM latest code from upstream and merges it in. Your voices, podcasts, settings and
REM stats live in different files from the app's code, so the merge never clashes.
cd /d "%~dp0"

set UPSTREAM_URL=https://github.com/pauldevelopai/node-podcasting.git

REM Make sure the 'upstream' remote (where code updates come from) exists.
REM One-time and automatic - nothing for you to set up.
git remote get-url upstream >nul 2>nul
if errorlevel 1 git remote add upstream %UPSTREAM_URL%

REM 1. Save your usage stats first so the folder is clean before merging.
echo Saving your usage stats...
call sync-telemetry.bat

REM 2. Fetch the latest code from the canonical repo.
echo Fetching the latest version...
git fetch --quiet upstream main
if errorlevel 1 (
  echo.
  echo   - Couldn't reach GitHub. Check your connection and try again - nothing was changed.
  pause
  goto :eof
)

REM 3. Merge the new code into your copy - code and your data are in separate
REM    files, so this merges cleanly and leaves your voices/podcasts untouched.
echo Applying the update...
git merge --no-edit upstream/main
if errorlevel 1 (
  git merge --abort 2>nul
  echo.
  echo   ! Couldn't apply the update automatically - nothing was changed and your
  echo     app still works. Please email Paul and mention "update merge".
  pause
  goto :eof
)

REM 4. Update dependencies (quick if nothing changed).
echo Updating dependencies...
call npm install

REM 5. Save the updated copy back to your GitHub fork (best-effort).
git push --quiet origin HEAD 2>nul

echo.
echo   Update complete. Run Start.bat to launch the app.
pause
