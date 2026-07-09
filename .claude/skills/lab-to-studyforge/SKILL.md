---
name: lab-to-studyforge
description: >-
  Convert GCP/Qwiklabs lab instructions into StudyForge learning materials via
  the External API and local interactive HTML explainers. Creates a per-lab
  subdirectory, uploads a study document, generates artifacts (quiz, flashcards,
  sequence quiz, diagram quiz, slide deck with local GCP images), and inherits
  parent prompt rules. Use when the user asks to publish a lab to StudyForge,
  create lab study materials, or run /lab-to-studyforge.
---

# Lab → StudyForge Learning Materials

Turn hands-on lab instructions into a full StudyForge study set: **local interactive HTML** (repo) + **documents & artifacts** (StudyForge app via External API).

## Directory IDs (fixed)

| Role | ID |
|------|-----|
| **Labs root** — one subdir per lab | `tgnqY2C9X2YQtA06JqHB` |
| **Rules parent** — attach shared prompt rules here; lab subdirs inherit | `lF9Hgmxxc42NdXKqKadY` |

## Prerequisites

1. **`STUDYFORGE_API_KEY`** env var — `sf-…` key from account settings. **Never commit the key.**
2. Read [interactive-html](../interactive-html/SKILL.md) for the local HTML explainer.
3. Read [docs/EXTERNAL_API.md](../../../docs/EXTERNAL_API.md) for endpoint details.
4. Parent rules bootstrapped once — run `scripts/lab-studyforge/bootstrap-parent-rules.sh` if `GET /directories/lF9Hgmxxc42NdXKqKadY/rules` returns empty `rules`.

## API defaults

```bash
export STUDYFORGE_API_BASE="${STUDYFORGE_API_BASE:-https://asia-east1-study-forge-202604.cloudfunctions.net/api}"
export STUDYFORGE_API_KEY="sf-your-key"   # required
```

Use `scripts/lab-studyforge/sf-api.sh` for all curl calls.

## Workflow (per lab)

Copy this checklist and track progress:

```
Lab publish progress:
- [ ] 1. Parse lab — objectives, tasks, resource names, commands, gotchas
- [ ] 2. Local HTML — docs/tasks/YYYY-MM/03-labs/<lab-slug>/ (interactive-html skill)
- [ ] 3. SF subdirectory — POST /directories under labs root
- [ ] 4. Study document — POST /documents (from lab summary markdown)
- [ ] 5. Artifacts — quiz, flashcards, sequence quiz, diagram quiz; slide deck with local images
- [ ] 6. Verify — list directory contents; confirm inherited rules
```

### Step 1 — Parse the lab

Extract and keep exact names (scorers check these):

- Lab code (e.g. GSP215, GSP662, ARC120)
- Objectives (3–5 bullets)
- Tasks with property tables (firewall names, MIG names, balancing modes)
- Commands (gcloud, bash, curl)
- Verification steps and common mistakes

Save a working copy under `docs/tasks/YYYY-MM/03-labs/<lab-slug>/` if not already there.

### Step 2 — Local interactive HTML

Follow **interactive-html** skill:

```
docs/tasks/YYYY-MM/03-labs/<lab-slug>/
├── <lab-slug>-lab.html
├── study-guide.md
├── images/*.png              # interactive HTML diagrams
└── slide-images/             # GCP-styled PNGs for StudyForge slide deck (01-….png, sorted)
```

Required tabs: Overview, Lab Flow (task picker), Architecture/Commands, Quiz (4–6 balanced MCQs).

Use **bash** snippets for lab commands (not TypeScript). Badge legend: VM = server, GCP Console = API, Browser/SSH = client.

**Mermaid:** prefer `flowchart` over `stateDiagram-v2`. Quote labels with numbers (`"403 Forbidden"`).

### Step 3 — Create StudyForge lab subdirectory

```bash
LAB_SLUG="gsp215-http-load-balancer"
LAB_TITLE="GSP215 — Cross-Regional Failover & Cloud Armor"

LAB_DIR_ID=$(./scripts/lab-studyforge/sf-api.sh POST /directories \
  "$(jq -nc --arg name "$LAB_TITLE" --arg parent "tgnqY2C9X2YQtA06JqHB" \
    '{name: $name, parentId: $parent}')" | jq -r '.data.id')
echo "Lab directory: $LAB_DIR_ID"
```

Slug convention: `<lab-code>-<short-topic>` (lowercase, hyphens).

### Step 4 — Upload study document

Build markdown from the lab (objectives → task summaries → key tables → commands → troubleshooting). Upload directly:

```bash
DOC_ID=$(./scripts/lab-studyforge/sf-api.sh POST /documents \
  "$(jq -nc \
    --arg title "$LAB_TITLE Study Guide" \
    --arg directoryId "$LAB_DIR_ID" \
    --rawfile content /path/to/study-guide.md \
    '{title: $title, content: $content, directoryId: $directoryId, sourceType: "MANUAL", tags: ["gcp-lab", "hands-on"]}')" \
  | jq -r '.data.id')
```

**Alternative** — AI generation when raw instructions need synthesis:

```bash
./scripts/lab-studyforge/sf-api.sh POST /documents/generate-from-prompt \
  "$(jq -nc \
    --arg prompt "Create a comprehensive study guide for GCP lab $LAB_TITLE. Include objectives, step summaries with exact resource names, command reference, verification checklist, and common mistakes." \
    --arg directoryId "$LAB_DIR_ID" \
    --rawfile f0 /path/to/lab-instructions.txt \
    '{prompt: $prompt, directoryId: $directoryId, files: [{filename: "lab.txt", content: $f0, size: ($f0|length), type: "text/plain", source: "upload"}]}')"
```

Inherited rules from `lF9Hgmxxc42NdXKqKadY` apply automatically (`ruleResolutionMode` defaults to inherit).

### Step 5 — Generate artifacts

Run from the lab subdirectory. Rules inherit from parent — no explicit `ruleIds` needed unless overriding.

```bash
# Quiz
./scripts/lab-studyforge/sf-api.sh POST /quizzes/generate \
  "$(jq -nc --argjson ids "[\"$DOC_ID\"]" --arg dir "$LAB_DIR_ID" --arg name "$LAB_TITLE Quiz" \
    '{documentIds: $ids, directoryId: $dir, quizName: $name, additionalPrompt: "Focus on exact resource names, balancing modes, and verification steps from this hands-on lab."}')"

# Flashcards
./scripts/lab-studyforge/sf-api.sh POST /flashcard-sets/generate \
  "$(jq -nc --argjson ids "[\"$DOC_ID\"]" --arg dir "$LAB_DIR_ID" --arg title "$LAB_TITLE Flashcards" \
    '{documentIds: $ids, directoryId: $dir, title: $title}')"

# Sequence quiz — task order and procedural flows (always generate)
./scripts/lab-studyforge/sf-api.sh POST /sequence-quizzes/generate \
  "$(jq -nc --argjson ids "[\"$DOC_ID\"]" --arg dir "$LAB_DIR_ID" \
    '{documentIds: $ids, directoryId: $dir, additionalPrompt: "Focus on correct task order, setup dependencies, and verification sequence from this lab."}')"

# Diagram quiz — architecture and traffic flows
./scripts/lab-studyforge/sf-api.sh POST /diagram-quizzes/generate \
  "$(jq -nc --argjson ids "[\"$DOC_ID\"]" --arg dir "$LAB_DIR_ID" \
    '{documentIds: $ids, directoryId: $dir}')"
```

#### Slide deck with local GCP images (required)

**Do not** use `POST /slide-decks/generate` for labs — images are generated locally, then uploaded.

1. **Plan slides** — one topic per slide (objectives, architecture, each task, key concepts). Name files `01-objectives.png`, `02-architecture.png`, … in `slide-images/`.
2. **Generate images** — use the image tool; GCP visual style:
   - Google Cloud palette: blue `#4285F4`, green `#34A853`, yellow `#FBBC04`, red `#EA4335`, grey `#F1F3F4` backgrounds
   - Include GCP-style icons: Compute Engine VMs, VPC network, Cloud Load Balancing, Cloud Armor shield, Cloud Logging
   - Flat vector / infographic; white or light-grey cards; exact lab resource names as labels
3. **Match count** — `additionalPrompt` must request **exactly N slides** where N = number of PNG files.
4. **Publish**:

```bash
N=8  # must match file count in slide-images/
./scripts/lab-studyforge/publish-slide-deck.sh \
  "$DOC_ID" "$LAB_DIR_ID" "$LAB_TITLE Review" \
  "docs/tasks/YYYY-MM/03-labs/<lab-slug>/slide-images" \
  "Produce exactly ${N} slides in order: 1) Objectives 2) Architecture 3) Task 1 Firewalls …"
```

If the API returns a count mismatch (`expectedImageCount` in the 400 response), adjust image count or prompt and retry.

Generation is async — artifacts appear as `pending` then `completed` in the app.

### Step 6 — Verify

```bash
./scripts/lab-studyforge/sf-api.sh GET "/directories/$LAB_DIR_ID/contents"
./scripts/lab-studyforge/sf-api.sh GET "/directories/$LAB_DIR_ID/rules"
```

Confirm: 1 document, expected artifacts, inherited rules from parent.

## Parent rules (one-time bootstrap)

Five shared rules live on **`lF9Hgmxxc42NdXKqKadY`** and inherit to every lab subdir. Content templates: [parent-rules.md](parent-rules.md).

Seven rules total (document, quiz, flashcards, diagram quiz, **sequence quiz**, **slide deck**, follow-up).

```bash
STUDYFORGE_API_KEY=sf-… ./scripts/lab-studyforge/bootstrap-parent-rules.sh
```

Idempotent — skips rules that already exist (matched by name).

## Artifact matrix

| Lab type | Document | Quiz | Flashcards | Slides (local images) | Diagram quiz | Sequence quiz |
|----------|----------|------|------------|----------------------|--------------|---------------|
| Network / LB / VPC | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| IAM / policy | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Compute / MIG | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Challenge (minimal steps) | ✓ | ✓ | ✓ | ✓ | — | ✓ |

Always create local interactive HTML regardless of matrix. Always generate **sequence quiz** and **slide deck with local GCP images**.

## Do not

- Commit `STUDYFORGE_API_KEY` or paste keys into repo files
- Invent resource names — labs are scored on exact names
- Skip the local HTML explainer — it complements SF artifacts
- Use `POST /slide-decks/generate` for labs — always generate images locally and use `publish-slide-deck.sh`
- Create lab subdirs outside `tgnqY2C9X2YQtA06JqHB`
- Attach rules to each lab subdir — attach once on parent; subdirs inherit

## Reference

- [parent-rules.md](parent-rules.md) — rule content templates
- [interactive-html](../interactive-html/SKILL.md) — local HTML explainer
- [docs/EXTERNAL_API.md](../../../docs/EXTERNAL_API.md) — full API
