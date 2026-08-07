#!/usr/bin/env bash
# Stop: once per continuation cycle, remind to /check when source files are dirty.
set -euo pipefail

INPUT="$(cat)"

if command -v jq >/dev/null 2>&1; then
  ACTIVE="$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false')"
else
  ACTIVE=false
  printf '%s' "$INPUT" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true' && ACTIVE=true
fi

[ "$ACTIVE" = "true" ] && exit 0

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$ROOT" || exit 0

DIRTY="$(git status --porcelain -- web admin functions libs 2>/dev/null | head -20 || true)"
[ -z "$DIRTY" ] && exit 0

MSG="Source changes detected under web/admin/functions/libs. Before finishing, run /check (or scoped /check web|admin|functions) and fix failures."

if command -v jq >/dev/null 2>&1; then
  jq -n --arg ctx "$MSG" '{
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext: $ctx
    }
  }'
else
  printf '%s\n' "$MSG" >&2
fi

exit 0
