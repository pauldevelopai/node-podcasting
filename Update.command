#!/usr/bin/env bash
# Double-click this to update Explain Podcast Studio to the latest version.
# The first time, your Mac may say "cannot verify the developer". Right-click
# this file → Open → Open in the dialog. That happens once.

cd "$(dirname "$0")"
echo "Fetching the latest version..."
git pull origin main
echo "Updating dependencies..."
npm install
echo ""
echo "  ✓ Update complete. Run Start.command to launch the app."
