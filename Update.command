#!/usr/bin/env bash
# Double-click this to update Podcast Studio to the latest version.
# The first time, your Mac may say "cannot verify the developer". Right-click
# this file → Open → Open in the dialog. That happens once.
#
# Your copy is a read-only mirror of the public app repo, so updating is just a
# pull — no login, nothing to push. Your voices, podcasts, settings and stats
# live in git-ignored files, so an update never touches them.

cd "$(dirname "$0")" || exit 1
echo "Fetching the latest version..."
git pull origin main
echo "Updating dependencies..."
npm install
echo ""
echo "  ✓ Update complete. Run Start.command to launch the app."
