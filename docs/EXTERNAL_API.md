# External API Reference

The external HTTP API lets you programmatically create documents, generate AI content, and retrieve artifacts using an API key.

## Base URLs

| Environment | URL |
|---|---|
| Production | `https://asia-east1-{project-id}.cloudfunctions.net/api` |
| Local emulator | `http://127.0.0.1:5001/{project-id}/asia-east1/api` |

---

## Authentication

Every request must carry credentials in one of three forms:

| Method | Header |
|---|---|
| API key (recommended) | `X-API-Key: sf-<your-key>` |
| API key as Bearer | `Authorization: Bearer sf-<your-key>` |
| Firebase ID token | `Authorization: Bearer eyJ...` |

Generate an API key from your account settings in the app.

---

## Endpoints

### Documents

#### `POST /documents` — Create a document

Create a document from existing content.

**Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✓ | Document title |
| `content` | string | ✓ | Markdown content |
| `directoryId` | string | ✓ | Target directory |
| `sourceType` | string | ✓ | e.g. `"MANUAL"`, `"GENERATED"` |
| `description` | string | | Short description |
| `tags` | string[] | | Tag list |

**Example**

```bash
curl -X POST https://asia-east1-{project-id}.cloudfunctions.net/api/documents \
  -H "X-API-Key: sf-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Binary Search Trees",
    "content": "# Binary Search Trees\n\nA BST is...",
    "directoryId": "dir_abc123",
    "sourceType": "MANUAL",
    "tags": ["data-structures", "trees"]
  }'
```

**Response `201`**

```json
{
  "success": true,
  "data": {
    "id": "doc_xyz789",
    "title": "Binary Search Trees",
    "directoryId": "dir_abc123",
    "sourceType": "MANUAL",
    "status": "ACTIVE",
    "createdAt": "2026-04-27T10:00:00.000Z"
  }
}
```

---

#### `POST /documents/generate-from-prompt` — Generate a document with AI

Provide a text prompt and Gemini AI will generate a full document. Optionally attach context files or rule IDs.

**Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | string | ✓ | What to learn about (min 10 chars) |
| `directoryId` | string | ✓ | Target directory |
| `ruleIds` | string[] | | Content generation rule IDs to inject |
| `files` | FileContent[] | | Context files (max 5, see below) |

**FileContent object**

| Field | Type | Required | Description |
|---|---|---|---|
| `filename` | string | ✓ | File name |
| `content` | string | ✓ | File text content |
| `size` | number | ✓ | File size in bytes |
| `type` | string | ✓ | `"text/plain"` or `"text/markdown"` |
| `source` | string | | `"upload"` or `"library"` |
| `documentId` | string | | Library document ID (when `source="library"`) |

**Example — basic prompt**

```bash
curl -X POST https://asia-east1-{project-id}.cloudfunctions.net/api/documents/generate-from-prompt \
  -H "X-API-Key: sf-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain DynamoDB provisioned capacity and when to use it over on-demand",
    "directoryId": "dir_abc123"
  }'
```

**Example — with rules and a context file**

```bash
curl -X POST https://asia-east1-{project-id}.cloudfunctions.net/api/documents/generate-from-prompt \
  -H "X-API-Key: sf-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain merge sort with step-by-step diagrams",
    "directoryId": "dir_abc123",
    "ruleIds": ["rule_mermaid_diagrams", "rule_dsa_doc"],
    "files": [
      {
        "filename": "notes.md",
        "content": "# My Notes\n\nFocus on time complexity analysis...",
        "size": 512,
        "type": "text/markdown",
        "source": "upload"
      }
    ]
  }'
```

**Response `201`**

```json
{
  "success": true,
  "data": {
    "documentId": "doc_xyz789",
    "title": "DynamoDB Provisioned Capacity",
    "content": "# DynamoDB Provisioned Capacity\n\n...",
    "wordCount": 1842,
    "metadata": {
      "originalPrompt": "Explain DynamoDB provisioned capacity...",
      "generatedAt": "2026-04-27T10:00:00.000Z",
      "filesUsed": 0
    }
  }
}
```

---

#### `POST /documents/generate-from-screenshot` — Generate a document from a screenshot

Send a visible-viewport screenshot as a base64 image or data URL. The generated Markdown document is saved in the target directory and uses inherited prompt rules by default.

This endpoint is rate limited per API key: 15 seconds between requests and 30 screenshots per hour.

**Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `imageBase64` | string | ✓ | Base64 image data or a `data:image/png;base64,...` URL |
| `directoryId` | string | ✓ | Target directory |
| `title` | string | | Optional document title override |
| `prompt` | string | | Optional extra instruction for document generation |
| `ruleIds` | string[] | | Optional explicit rule IDs |
| `ruleResolutionMode` | string | | `inherit`, `inherit-plus-explicit`, or `explicit-only` |

**Example**

```bash
curl -X POST https://asia-east1-{project-id}.cloudfunctions.net/api/documents/generate-from-screenshot \
  -H "X-API-Key: sf-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "imageBase64": "data:image/png;base64,iVBORw0KGgo...",
    "directoryId": "dir_abc123"
  }'
```

**Response `201`**

```json
{
  "success": true,
  "data": {
    "documentId": "doc_xyz789",
    "title": "Captured Document",
    "content": "# Captured Document\n\n...",
    "wordCount": 936,
    "metadata": {
      "generatedAt": "2026-04-27T10:00:00.000Z",
      "sourceType": "screenshot",
      "directoryId": "dir_abc123"
    }
  }
}
```

**Response `429`**

```json
{
  "success": false,
  "error": "Screenshot capture is cooling down. Try again in a few seconds.",
  "retryAfterSeconds": 12
}
```

---

#### `GET /documents` — List documents

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | number | 20 | Max results (max 100) |
| `offset` | number | 0 | Pagination offset |
| `directoryId` | string | | Filter by directory |
| `sourceType` | string | | Filter by source type |
| `status` | string | | Filter by status |
| `sortBy` | string | `createdAt` | `createdAt`, `updatedAt`, or `title` |
| `sortOrder` | string | `desc` | `asc` or `desc` |

**Example**

```bash
curl "https://asia-east1-{project-id}.cloudfunctions.net/api/documents?directoryId=dir_abc123&limit=10" \
  -H "X-API-Key: sf-your-key-here"
```

---

#### `GET /documents/:id` — Get document metadata

```bash
curl "https://asia-east1-{project-id}.cloudfunctions.net/api/documents/doc_xyz789" \
  -H "X-API-Key: sf-your-key-here"
```

---

#### `GET /documents/:id/content` — Get document content

```bash
curl "https://asia-east1-{project-id}.cloudfunctions.net/api/documents/doc_xyz789/content" \
  -H "X-API-Key: sf-your-key-here"
```

---

### Directories

#### `POST /directories` — Create a directory

```bash
curl -X POST https://asia-east1-{project-id}.cloudfunctions.net/api/directories \
  -H "X-API-Key: sf-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Algorithms",
    "parentId": null
  }'
```

#### `GET /directories` — List directories

```bash
# Flat list
curl "https://asia-east1-{project-id}.cloudfunctions.net/api/directories" \
  -H "X-API-Key: sf-your-key-here"

# Tree view
curl "https://asia-east1-{project-id}.cloudfunctions.net/api/directories?tree=true" \
  -H "X-API-Key: sf-your-key-here"
```

#### `GET /directories/:id/contents` — Get directory contents

```bash
curl "https://asia-east1-{project-id}.cloudfunctions.net/api/directories/dir_abc123/contents" \
  -H "X-API-Key: sf-your-key-here"
```

#### `GET /directories/:id/rules` — Get resolved rules for a directory

Returns direct and inherited rules for the directory.

```bash
curl "https://asia-east1-{project-id}.cloudfunctions.net/api/directories/dir_abc123/rules" \
  -H "X-API-Key: sf-your-key-here"
```

#### `POST /directories/:id/rules` — Attach a rule to a directory

Links an existing rule to a directory. The rule's content then inherits to descendant directories.

**Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `ruleId` | string | ✓ | Rule to attach |

```bash
curl -X POST "https://asia-east1-{project-id}.cloudfunctions.net/api/directories/dir_abc123/rules" \
  -H "X-API-Key: sf-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{"ruleId": "rule_xyz789"}'
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "directoryId": "dir_abc123",
    "ruleId": "rule_xyz789"
  }
}
```

---

### Rules

#### `POST /rules` — Create a rule

```bash
curl -X POST https://asia-east1-{project-id}.cloudfunctions.net/api/rules \
  -H "X-API-Key: sf-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Use Mermaid Diagrams",
    "content": "Always use Mermaid.js for diagrams. Never use ASCII art.",
    "color": "BLUE",
    "applicableTo": ["DOCUMENT", "QUIZ"]
  }'
```

#### `GET /rules` — List rules

```bash
# All rules
curl "https://asia-east1-{project-id}.cloudfunctions.net/api/rules" \
  -H "X-API-Key: sf-your-key-here"

# Filter by applicability
curl "https://asia-east1-{project-id}.cloudfunctions.net/api/rules?applicableTo=quiz,document" \
  -H "X-API-Key: sf-your-key-here"
```

#### `GET /rules/:id` — Get a single rule

```bash
curl "https://asia-east1-{project-id}.cloudfunctions.net/api/rules/rule_mermaid_diagrams" \
  -H "X-API-Key: sf-your-key-here"
```

---

### Quizzes

#### `POST /quizzes/generate` — Generate a quiz

```bash
curl -X POST https://asia-east1-{project-id}.cloudfunctions.net/api/quizzes/generate \
  -H "X-API-Key: sf-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "documentIds": ["doc_xyz789"],
    "directoryId": "dir_abc123",
    "quizName": "DynamoDB Deep Dive Quiz",
    "additionalPrompt": "Focus on capacity planning questions"
  }'
```

#### `GET /quizzes` — List quizzes

```bash
curl "https://asia-east1-{project-id}.cloudfunctions.net/api/quizzes?directoryId=dir_abc123" \
  -H "X-API-Key: sf-your-key-here"
```

---

### Flashcard Sets

#### `POST /flashcard-sets/generate` — Generate flashcards

```bash
curl -X POST https://asia-east1-{project-id}.cloudfunctions.net/api/flashcard-sets/generate \
  -H "X-API-Key: sf-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "documentIds": ["doc_xyz789"],
    "directoryId": "dir_abc123",
    "title": "DynamoDB Flashcards"
  }'
```

#### `GET /flashcard-sets` — List flashcard sets

```bash
curl "https://asia-east1-{project-id}.cloudfunctions.net/api/flashcard-sets?directoryId=dir_abc123" \
  -H "X-API-Key: sf-your-key-here"
```

---

### Slide Decks

#### `POST /slide-decks/generate` — Generate a slide deck

```bash
curl -X POST https://asia-east1-{project-id}.cloudfunctions.net/api/slide-decks/generate \
  -H "X-API-Key: sf-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "documentIds": ["doc_xyz789"],
    "directoryId": "dir_abc123",
    "title": "DynamoDB Slides",
    "additionalPrompt": "Keep slides concise, 3 bullet points max per slide"
  }'
```

#### `POST /slide-decks/generate-with-images` — Generate a slide deck with caller-supplied images

Generates slide text from the document(s), then binds pre-generated images **positionally**: `images[i]` → slide `i`. Image count must match the generated slide count exactly (otherwise `400` with `expectedImageCount` / `providedImageCount`).

**Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `documentIds` | string[] | ✓ | Source documents (max 5) |
| `directoryId` | string | ✓ | Target directory |
| `title` | string | | Deck title |
| `additionalPrompt` | string | | Outline guidance; use `"Produce exactly N slides…"` to control count |
| `images` | object[] | ✓ | `{ data: base64, contentType?: "image/png" }` per slide, in order |
| `ruleIds` | string[] | | Optional explicit rules |
| `ruleResolutionMode` | string | | `inherit`, `inherit-plus-explicit`, or `explicit-only` |

```bash
curl -X POST https://asia-east1-{project-id}.cloudfunctions.net/api/slide-decks/generate-with-images \
  -H "X-API-Key: sf-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "documentIds": ["doc_xyz789"],
    "directoryId": "dir_abc123",
    "title": "GCP Lab Review",
    "additionalPrompt": "Produce exactly 2 slides: 1) Objectives 2) Architecture",
    "images": [
      {"data": "<base64-png>", "contentType": "image/png"},
      {"data": "<base64-png>", "contentType": "image/png"}
    ]
  }'
```

**Lab workflow:** generate GCP-styled PNGs locally, then upload via this endpoint. See `scripts/lab-studyforge/publish-slide-deck.sh`.

#### `GET /slide-decks` — List slide decks

```bash
curl "https://asia-east1-{project-id}.cloudfunctions.net/api/slide-decks?directoryId=dir_abc123" \
  -H "X-API-Key: sf-your-key-here"
```

---

### Diagram Quizzes

#### `POST /diagram-quizzes/generate` — Generate a diagram quiz

```bash
curl -X POST https://asia-east1-{project-id}.cloudfunctions.net/api/diagram-quizzes/generate \
  -H "X-API-Key: sf-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "documentIds": ["doc_xyz789"],
    "directoryId": "dir_abc123"
  }'
```

#### `GET /diagram-quizzes` — List diagram quizzes

```bash
curl "https://asia-east1-{project-id}.cloudfunctions.net/api/diagram-quizzes?directoryId=dir_abc123" \
  -H "X-API-Key: sf-your-key-here"
```

---

### Sequence Quizzes

#### `POST /sequence-quizzes/generate` — Generate a sequence quiz

```bash
curl -X POST https://asia-east1-{project-id}.cloudfunctions.net/api/sequence-quizzes/generate \
  -H "X-API-Key: sf-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "documentIds": ["doc_xyz789"],
    "directoryId": "dir_abc123"
  }'
```

#### `GET /sequence-quizzes` — List sequence quizzes

```bash
curl "https://asia-east1-{project-id}.cloudfunctions.net/api/sequence-quizzes?directoryId=dir_abc123" \
  -H "X-API-Key: sf-your-key-here"
```

---

## Error Responses

All errors follow the same shape:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

| Status | Meaning |
|---|---|
| `400` | Bad request — missing or invalid fields |
| `401` | Unauthorized — missing or invalid API key |
| `404` | Route or resource not found |
| `500` | Internal server error |

---

## End-to-end example: generate a document then a quiz

```bash
BASE="https://asia-east1-{project-id}.cloudfunctions.net/api"
KEY="sf-your-key-here"

# 1. Create a directory
DIR_ID=$(curl -s -X POST "$BASE/directories" \
  -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Study Set"}' | jq -r '.data.id')

# 2. Generate a document from a prompt
DOC_ID=$(curl -s -X POST "$BASE/documents/generate-from-prompt" \
  -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"Explain how Redis handles cache eviction strategies in depth\",
    \"directoryId\": \"$DIR_ID\"
  }" | jq -r '.data.documentId')

# 3. Generate a quiz from the produced document
curl -s -X POST "$BASE/quizzes/generate" \
  -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"documentIds\": [\"$DOC_ID\"],
    \"directoryId\": \"$DIR_ID\",
    \"quizName\": \"Redis Eviction Quiz\"
  }" | jq '.data.quizId'
```
