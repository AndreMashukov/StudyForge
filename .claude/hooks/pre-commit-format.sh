#!/bin/bash
# Pre-commit formatting hook for Claude Code
# Runs Prettier on staged files before git commit

if [[ -z "$CLAUDE_TOOL_INPUT" ]]; then
  exit 0
fi

if ! echo "$CLAUDE_TOOL_INPUT" | grep -q '"command".*git commit'; then
  exit 0
fi

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '^(web|admin|functions|libs)/.*\.(ts|tsx|css|json|md)$')

if [[ -z "$STAGED_FILES" ]]; then
  exit 0
fi

LINES_CHANGED=$(git diff --cached --numstat $STAGED_FILES 2>/dev/null | awk '{sum += $1 + $2} END {print sum+0}')
if [[ "$LINES_CHANGED" -lt 10 ]]; then
  exit 0
fi

if ! yarn prettier --check $STAGED_FILES >/dev/null 2>&1; then
  echo "Prettier: Formatting issues found. Auto-fixing..."
  yarn prettier --write $STAGED_FILES >/dev/null 2>&1
  git add $STAGED_FILES
  echo "Prettier: Files formatted and re-staged."
fi

exit 0
