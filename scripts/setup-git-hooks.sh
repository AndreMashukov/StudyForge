#!/usr/bin/env bash
# Install repo git hooks (pre-commit secret scanning via gitleaks).
set -eu

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

chmod +x .githooks/pre-commit
git config core.hooksPath .githooks

echo "Installed git hooks from .githooks/ (pre-commit: gitleaks protect --staged)"
echo "Requires gitleaks: brew install gitleaks"
