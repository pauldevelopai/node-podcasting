@echo off
REM ===========================================================================
REM  sync-telemetry.bat - best-effort push of this Node's telemetry to the
REM  GROUNDED cohort dashboard. Called by Start.bat and Update.bat.
REM
REM  Commits + pushes ONLY metadata (data/processed/node_podcasting_*.json):
REM  install id, activity, errors, feedback, voice/podcast metadata. It NEVER
REM  touches your audio, transcripts, voice samples, or API keys - those are
REM  git-ignored and stay on this computer.
REM
REM  Does nothing when there's nothing new; never blocks or fails the launch.
REM ===========================================================================
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 goto :eof

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 goto :eof

REM Stage ONLY the telemetry JSON - never the whole tree.
git add data/processed/node_podcasting_*.json >nul 2>nul

REM Nothing staged (no new telemetry)? Done.
git diff --cached --quiet >nul 2>nul
if not errorlevel 1 goto :eof

git -c user.name="GROUNDED Node" -c user.email="node@developai.local" commit -q -m "telemetry: sync install + activity" >nul 2>nul

git push -q origin HEAD >nul 2>nul
if errorlevel 1 (
  echo   - Couldn't reach GitHub right now; your stats will sync next launch.
) else (
  echo   + Synced your usage stats to the GROUNDED dashboard.
)
goto :eof
