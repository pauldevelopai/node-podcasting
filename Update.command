#!/usr/bin/env bash
# Double-click this to update Podcast Studio to the latest version.
# The first time, your Mac may say "cannot verify the developer". Right-click
# this file → Open → Open in the dialog. That happens once.
#
# How updating works: your own usage stats live in YOUR copy on GitHub (origin).
# The app's code updates come from the canonical repo (upstream). This pulls the
# latest code from upstream and merges it in. Your voices, podcasts, settings and
# stats live in different files from the app's code, so the merge never clashes.

cd "$(dirname "$0")" || exit 1

UPSTREAM_URL="https://github.com/pauldevelopai/node-podcasting.git"

# Make sure the 'upstream' remote (where code updates come from) exists.
# One-time and automatic — nothing for you to set up.
git remote get-url upstream >/dev/null 2>&1 || git remote add upstream "$UPSTREAM_URL"

# 1. Save your usage stats first so the folder is clean before merging.
echo "Saving your usage stats..."
bash ./sync-telemetry.sh

# 2. Fetch the latest code from the canonical repo.
echo "Fetching the latest version..."
if ! git fetch --quiet upstream main; then
  echo ""
  echo "  • Couldn't reach GitHub. Check your connection and try again — nothing was changed."
  exit 0
fi

# 3. Merge the new code into your copy. Code and your data live in separate
#    files, so this merges cleanly and leaves your voices/podcasts untouched.
echo "Applying the update..."
if ! git merge --no-edit upstream/main; then
  git merge --abort 2>/dev/null
  echo ""
  echo "  ! Couldn't apply the update automatically — nothing was changed and your"
  echo "    app still works. Please email Paul and mention \"update merge\"."
  exit 1
fi

# 4. Update dependencies (quick if nothing changed).
echo "Updating dependencies..."
npm install

# 5. Save the updated copy back to your GitHub fork (best-effort; if it can't
#    reach GitHub now, it syncs on your next launch).
git push --quiet origin HEAD 2>/dev/null

echo ""
echo "  ✓ Update complete. Run Start.command to launch the app."
