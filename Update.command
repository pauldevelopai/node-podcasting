#!/usr/bin/env bash
# Double-click this to update Podcast Studio to the latest version.
# The first time, your Mac may say "cannot verify the developer". Right-click
# this file → Open → Open in the dialog. That happens once.

cd "$(dirname "$0")"
# First, push any local usage stats so they're not lost during the update.
bash ./sync-telemetry.sh
echo "Fetching the latest version..."
git pull origin main
echo "Updating dependencies..."
npm install
echo ""
echo "  ✓ Update complete. Run Start.command to launch the app."
