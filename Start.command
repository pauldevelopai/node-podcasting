#!/usr/bin/env bash
# Double-click this to launch Podcast Studio.
# The first time, your Mac may say "cannot verify the developer". Right-click
# this file → Open → Open in the dialog. That happens once.

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run only) — this takes about a minute..."
  npm install
fi

# Push usage stats from previous sessions to the GROUNDED dashboard
# (metadata only — never your audio, transcripts, or keys). Best-effort.
bash ./sync-telemetry.sh

# Open the browser a few seconds after the server starts.
( sleep 3 && open http://localhost:3000 ) &
npm start

# App has stopped — sync this session's stats too (runs when you press Ctrl+C).
bash ./sync-telemetry.sh
