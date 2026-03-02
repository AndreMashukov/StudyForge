#!/usr/bin/env bash
# One-time cleanup: remove debug scripts, keep only backup/restore + e2e-setup
set -e

cd "$(dirname "$0")/.."

echo "=== Deleting .js files in scripts/ ==="
rm -f scripts/test-document-load.js scripts/test-flashcard-debug.js scripts/test-manual-flashcard.js \
  scripts/test-documents-quick.js scripts/e2e-test-flashcards-v2.js scripts/simple-login-test.js \
  scripts/test-complete-flashcard-flow.js scripts/test-document-content.js scripts/test-flashcard-generation.js \
  scripts/e2e-test-flashcards.js scripts/debug-auth.js scripts/debug-frontend.js scripts/check-console-errors.js

echo "=== Deleting .ts files (except e2e-setup/, backup-firestore.ts, restore-firestore.ts) ==="
rm -f scripts/fix-document.ts scripts/test-get-content.ts scripts/seed-for-e2e.ts scripts/check-storage.ts \
  scripts/create-flashcard-test-data.ts scripts/check-firestore-data.ts scripts/check-document-fields.ts \
  scripts/verify-firestore-users.ts scripts/migrate-to-user-collections.ts scripts/restore-firebase.ts \
  scripts/backup-firebase.ts scripts/deep-check-users.ts scripts/backup-firebase-auth.ts \
  scripts/restore-firebase-latest.ts scripts/restore-firebase-rules.ts scripts/check-user-doc.ts \
  scripts/restore-firebase-auth.ts scripts/backup-firebase-rules.ts scripts/clear-firestore.ts

echo "=== Moving tests/e2e/ to e2e/ at root ==="
mkdir -p e2e
mv tests/e2e/* e2e/
rmdir tests/e2e 2>/dev/null || true
rmdir tests 2>/dev/null || true

echo "=== Verifying no .png files in repo ==="
PNG_COUNT=$(find . -name "*.png" -not -path "./node_modules/*" -not -path "./.git/*" 2>/dev/null | wc -l)
if [ "$PNG_COUNT" -gt 0 ]; then
  echo "WARNING: Found $PNG_COUNT .png file(s):"
  find . -name "*.png" -not -path "./node_modules/*" -not -path "./.git/*" 2>/dev/null
  exit 1
fi
echo "No .png files in repo (OK)"

echo "=== Deleting this cleanup script ==="
rm -f scripts/cleanup-debug-session.sh

echo "=== Done. Run: git add -A && git status && git commit --amend --no-edit && git push --force-with-lease ==="
