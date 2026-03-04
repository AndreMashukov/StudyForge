#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# emulators-dev.sh
#
# Starts Firebase emulators, waits until all ports are ready, then runs the
# seed script so local dev always has a usable baseline data set.
#
# Usage:
#   yarn emulators:dev              # start + seed (default project)
#   SEED=false yarn emulators:dev   # start only, skip seeding
#   EXPORT_ON_EXIT=true yarn emulators:dev   # persist emulator state on exit
#
# Env vars honoured:
#   FIREBASE_PROJECT   — Firebase project ID (default: demo-project)
#   AUTH_PORT          — Auth emulator port   (default: 9099)
#   FIRESTORE_PORT     — Firestore port       (default: 8080)
#   STORAGE_PORT       — Storage port         (default: 9199)
#   SEED               — Set to "false" to skip seeding (default: true)
#   EXPORT_ON_EXIT     — Set to "true" to export state to ./emulator-data on exit
# ---------------------------------------------------------------------------
set -euo pipefail

FIREBASE_PROJECT="${FIREBASE_PROJECT:-demo-project}"
AUTH_PORT="${AUTH_PORT:-9099}"
FIRESTORE_PORT="${FIRESTORE_PORT:-8080}"
STORAGE_PORT="${STORAGE_PORT:-9199}"
SEED="${SEED:-true}"
EXPORT_ON_EXIT="${EXPORT_ON_EXIT:-false}"

WAIT_TIMEOUT="${WAIT_TIMEOUT:-60000}"   # ms

# Build emulators:start flags
EMULATOR_FLAGS="--project $FIREBASE_PROJECT"
if [[ "$EXPORT_ON_EXIT" == "true" ]]; then
  EMULATOR_FLAGS="$EMULATOR_FLAGS --import=./emulator-data --export-on-exit=./emulator-data"
fi

cleanup() {
  echo ""
  echo "🛑 Shutting down emulators (PID: $EMULATOR_PID)…"
  kill "$EMULATOR_PID" 2>/dev/null || true
  wait "$EMULATOR_PID" 2>/dev/null || true
  echo "   Done."
}
trap cleanup EXIT INT TERM

echo "🔥 Starting Firebase emulators (project: $FIREBASE_PROJECT)…"
npx firebase emulators:start $EMULATOR_FLAGS &
EMULATOR_PID=$!

echo "⏳ Waiting for emulator ports to open…"
npx wait-on \
  "tcp:${AUTH_PORT}" \
  "tcp:${FIRESTORE_PORT}" \
  "tcp:${STORAGE_PORT}" \
  --timeout "$WAIT_TIMEOUT"

echo "   ✅ All emulator ports are ready"

if [[ "$SEED" != "false" ]]; then
  echo ""
  FIRESTORE_EMULATOR_HOST="localhost:${FIRESTORE_PORT}" \
  FIREBASE_AUTH_EMULATOR_HOST="localhost:${AUTH_PORT}" \
  FIREBASE_STORAGE_EMULATOR_HOST="localhost:${STORAGE_PORT}" \
  npx tsx scripts/seed.ts
fi

echo ""
echo "🚀 Emulators running. Press Ctrl+C to stop."
wait "$EMULATOR_PID"
