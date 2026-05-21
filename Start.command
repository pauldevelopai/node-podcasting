#!/usr/bin/env bash
# Double-click this to launch Explain Podcast Studio.
# The first time, your Mac may say "cannot verify the developer". Right-click
# this file → Open → Open in the dialog. That happens once.

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run only) — this takes about a minute..."
  npm install
fi

# Open the browser a few seconds after the server starts.
( sleep 3 && open http://localhost:3000 ) &
npm start
