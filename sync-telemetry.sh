#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# sync-telemetry.sh — best-effort push of this Node's telemetry to the
# GROUNDED cohort dashboard. Called by Start.command and Update.command.
#
# Commits and pushes ONLY the metadata files —
#   data/processed/node_podcasting_*.json
# (install id, activity, errors, feedback, voice/podcast metadata). It NEVER
# touches your audio, transcripts, voice samples, or API keys — those are
# git-ignored and stay on this computer.
#
# Safe to run on every launch: it does nothing when there's nothing new, and
# it never blocks the app or fails the launch if git or GitHub is unavailable.
# ─────────────────────────────────────────────────────────────────────────────

cd "$(dirname "$0")" || exit 0

# git installed? inside a repo? has an 'origin' remote? — otherwise quietly skip.
command -v git >/dev/null 2>&1            || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
git remote | grep -qx origin             || exit 0

# Stage ONLY the telemetry JSON — never the whole tree.
git add data/processed/node_podcasting_*.json >/dev/null 2>&1

# Nothing staged (no new telemetry since last time)? Done.
git diff --cached --quiet >/dev/null 2>&1 && exit 0

# Commit with a fixed identity so it works even if the user's global git
# name/email aren't set, and so commits are clearly the Node's, not theirs.
git -c user.name="GROUNDED Node" -c user.email="node@developai.local" \
    commit -q -m "telemetry: sync install + activity" >/dev/null 2>&1 || exit 0

if git push -q origin HEAD >/dev/null 2>&1; then
  echo "  ✓ Synced your usage stats to the GROUNDED dashboard."
else
  echo "  • Couldn't reach GitHub right now — your stats will sync next launch."
fi
