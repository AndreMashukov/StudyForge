#!/usr/bin/env bash
# StudyForge External API curl wrapper.
# Requires: STUDYFORGE_API_KEY (sf-…)
# Optional: STUDYFORGE_API_BASE (defaults to production)

set -euo pipefail

METHOD="${1:?Usage: sf-api.sh METHOD PATH [JSON_BODY]}"
PATH_STR="${2:?Usage: sf-api.sh METHOD PATH [JSON_BODY]}"
BODY="${3:-}"

BASE="${STUDYFORGE_API_BASE:-https://asia-east1-study-forge-202604.cloudfunctions.net/api}"
KEY="${STUDYFORGE_API_KEY:?Set STUDYFORGE_API_KEY (sf-…)}"

CURL_ARGS=(-sS -X "$METHOD" "${BASE}${PATH_STR}" -H "X-API-Key: $KEY" -H "Content-Type: application/json")

if [[ -n "$BODY" ]]; then
  CURL_ARGS+=(-d "$BODY")
fi

RESPONSE="$(curl "${CURL_ARGS[@]}")"

if ! echo "$RESPONSE" | jq -e '.success == true' >/dev/null 2>&1; then
  echo "StudyForge API error ($METHOD $PATH_STR):" >&2
  echo "$RESPONSE" | jq . >&2 2>/dev/null || echo "$RESPONSE" >&2
  exit 1
fi

echo "$RESPONSE"
