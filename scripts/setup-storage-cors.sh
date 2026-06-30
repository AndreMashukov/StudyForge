#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUCKET="${STORAGE_CORS_BUCKET:-study-forge-202604.firebasestorage.app}"
CORS_FILE="${STORAGE_CORS_FILE:-$ROOT_DIR/scripts/storage-cors.json}"

if ! command -v gsutil >/dev/null 2>&1; then
  echo "gsutil is required. Install Google Cloud SDK and authenticate with gcloud auth login."
  exit 1
fi

if [[ ! -f "$CORS_FILE" ]]; then
  echo "CORS config not found: $CORS_FILE"
  exit 1
fi

echo "Applying Storage CORS from $CORS_FILE to gs://$BUCKET ..."
gsutil cors set "$CORS_FILE" "gs://$BUCKET"

echo "Current CORS configuration:"
gsutil cors get "gs://$BUCKET"
