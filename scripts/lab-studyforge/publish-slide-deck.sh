#!/usr/bin/env bash
# Publish a slide deck with locally generated images via POST /slide-decks/generate-with-images.
#
# Usage:
#   publish-slide-deck.sh DOC_ID DIRECTORY_ID TITLE SLIDE_IMAGES_DIR [ADDITIONAL_PROMPT]
#
# SLIDE_IMAGES_DIR must contain *.png / *.webp / *.jpg / *.jpeg / *.gif sorted by filename.
# images[i] binds to slides[i] — count MUST match the LLM outline or API returns 400 with expectedImageCount.
#
# Tip: set additionalPrompt to "Produce exactly N slides covering: …" where N = image file count.

set -euo pipefail

DOC_ID="${1:?DOC_ID required}"
DIRECTORY_ID="${2:?DIRECTORY_ID required}"
TITLE="${3:?TITLE required}"
IMAGES_DIR="${4:?SLIDE_IMAGES_DIR required}"
ADDITIONAL_PROMPT="${5:-One concept per slide; use exact GCP resource names from the lab.}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -d "$IMAGES_DIR" ]]; then
  echo "Images directory not found: $IMAGES_DIR" >&2
  exit 1
fi

IMAGE_COUNT="$(python3 - "$IMAGES_DIR" "$DOC_ID" "$DIRECTORY_ID" "$TITLE" "$ADDITIONAL_PROMPT" <<'PY'
import base64
import glob
import json
import os
import sys

images_dir, doc_id, directory_id, title, additional_prompt = sys.argv[1:6]
patterns = ["*.png", "*.webp", "*.jpg", "*.jpeg", "*.gif"]
files: list[str] = []
for pattern in patterns:
    files.extend(glob.glob(os.path.join(images_dir, pattern)))
files = sorted(set(files))

if not files:
    print("error: no image files found", file=sys.stderr)
    sys.exit(1)

items = []
for path in files:
    ext = os.path.splitext(path)[1].lower()
    content_type = {
        ".png": "image/png",
        ".webp": "image/webp",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
    }.get(ext, "image/png")
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode("ascii")
    items.append({"data": data, "contentType": content_type})

payload = {
    "documentIds": [doc_id],
    "directoryId": directory_id,
    "title": title,
    "additionalPrompt": additional_prompt,
    "images": items,
}

out_path = os.path.join(os.environ.get("TMPDIR", "/tmp"), "sf-slide-deck-payload.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(payload, f)

print(len(items))
print(out_path)
PY
)"

IMAGE_NUM="$(echo "$IMAGE_COUNT" | head -1)"
PAYLOAD_FILE="$(echo "$IMAGE_COUNT" | tail -1)"
echo "Uploading $IMAGE_NUM slide image(s) from $IMAGES_DIR"

RESP="$(mktemp)"
HTTP_CODE="$(curl -sS -w "%{http_code}" -o "$RESP" -X POST \
  "${STUDYFORGE_API_BASE:-https://asia-east1-study-forge-202604.cloudfunctions.net/api}/slide-decks/generate-with-images" \
  -H "X-API-Key: ${STUDYFORGE_API_KEY:?Set STUDYFORGE_API_KEY}" \
  -H "Content-Type: application/json" \
  --data-binary "@${PAYLOAD_FILE}")"

rm -f "$PAYLOAD_FILE"

if [[ "$HTTP_CODE" == "201" ]]; then
  jq '{success, slideDeckId: .data.slideDeckId}' "$RESP"
  rm -f "$RESP"
  exit 0
fi

echo "Slide deck publish failed (HTTP $HTTP_CODE):" >&2
jq . "$RESP" >&2 2>/dev/null || cat "$RESP" >&2

if jq -e '.data.expectedImageCount' "$RESP" >/dev/null 2>&1; then
  EXPECTED="$(jq -r '.data.expectedImageCount' "$RESP")"
  PROVIDED="$(jq -r '.data.providedImageCount' "$RESP")"
  echo "" >&2
  echo "Count mismatch: API expected $EXPECTED images, you provided $PROVIDED." >&2
  echo "Update additionalPrompt to request exactly $EXPECTED slides, or add/remove images and retry." >&2
fi

rm -f "$RESP"
exit 1
