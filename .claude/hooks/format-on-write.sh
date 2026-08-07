#!/usr/bin/env bash
# PostToolUse (Edit|Write): format touched source files with Prettier via yarn.
set -euo pipefail

INPUT="$(cat)"

if command -v jq >/dev/null 2>&1; then
  FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')"
else
  FILE_PATH="$(printf '%s' "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
fi

[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  web/*|admin/*|functions/*|libs/*) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.css|*.md|*.yml|*.yaml|*.html)
    ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
    if [ -x "$ROOT/node_modules/.bin/prettier" ]; then
      "$ROOT/node_modules/.bin/prettier" --write "$FILE_PATH" >/dev/null 2>&1 || \
        echo "format-on-write: prettier failed on $FILE_PATH" >&2
    elif command -v yarn >/dev/null 2>&1; then
      (cd "$ROOT" && yarn prettier --write "$FILE_PATH") >/dev/null 2>&1 || \
        echo "format-on-write: yarn prettier failed on $FILE_PATH" >&2
    fi
    ;;
esac

exit 0
