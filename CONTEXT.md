# StudyForge

AI-powered study platform: users organize **source documents** in **directories**, apply **rules** to steer generation, and produce **artifacts** (quizzes, flashcards, slide decks, and more) for learning.

Maintained via `/grill-with-docs`. Architectural decisions live in `docs/adr/`.

## Organization

**Directory**:
A hierarchical folder in a user's library. Owns documents, artifacts, and attached rules. Directories nest via `parentId`; ancestor rules inherit to descendants unless resolution mode says otherwise.
_Avoid_: folder, collection, workspace (when meaning a single directory)

**Library**:
The user's full set of directories and documents — not a separate datastore, but the product concept of "everything I study."
_Avoid_: corpus, datastore

**Document**:
User-owned source material (upload, URL import, or prompt-generated markdown) used as input for artifact generation. Distinct from artifacts: a document is *read*; an artifact is *studied*.
_Avoid_: source doc, file (when meaning study content), content item

## Generated content

**Artifact**:
Any AI-generated study output stored in a directory: quiz, flashcard set, slide deck, diagram quiz, sequence quiz, or subject world.
_Avoid_: content, output, generated doc

**Quiz**:
Multiple-choice questions derived from one or more documents. Generic quiz type — not a diagram quiz or sequence quiz.
_Avoid_: test, assessment (unless user-facing copy)

**Diagram quiz**:
Quiz where each question presents four Mermaid diagrams; the learner picks the diagram that correctly answers the prompt.
_Avoid_: diagram test, mermaid quiz

**Sequence quiz**:
Ordering quiz: the learner arranges shuffled items into the correct sequence.
_Avoid_: ordering quiz, sort quiz

**Flashcard set**:
Front/back cards (with optional descriptions) derived from source documents.
_Avoid_: deck (alone — prefer "flashcard set"), cards

**Slide deck**:
Presentation slides with speaker notes, optionally with generated images.
_Avoid_: presentation, deck (when meaning slides)

**Subject world**:
An explorable 3D voxel environment defined by a JSON **world spec** (`SubjectWorldSpec`), not hand-authored 3D code. Includes quiz gates the learner unlocks while exploring.
_Avoid_: 3D world, game level, map (alone)

## Generation lifecycle

**Generation status**:
Lifecycle on documents and artifacts: `pending` (AI work in flight), `completed` (ready to use), or `failed` (error recorded). Missing status on older records means completed.
_Avoid_: processing state, job status (when meaning the artifact record itself)

**Generation job**:
Durable async work unit for AI generation. Every generation kind runs through a generation job; endpoints create a pending record, enqueue the job, and return immediately. Tracks attempts and status separately from the visible document/artifact record the UI shows as pending.
_Avoid_: task (alone), background job, inline generation

**Pending record**:
A document or artifact Firestore record created before generation finishes, with `generationStatus: pending`, so the UI can show progress without waiting for the LLM.
_Avoid_: stub, placeholder record

**Artifact agent platform**:
Shared server-side pipeline (ADK-orchestrated) that generates an artifact, runs verification gates, self-repairs failures, and only marks the record completed when gates pass.
_Avoid_: agent service, generation pipeline (when meaning this specific platform)

## AI routing

**LLM setup**:
Admin-managed routing profile. Each **generation kind** maps to a **generation route** (provider, model, required modality, workflow). Legacy modality routes (`text`, `vision`, `image`) are being phased out.
_Avoid_: model setting, active provider, preset

**Generation kind**:
Admin-configurable category of routed LLM work — production (quiz, screenshot document), interactive (directory chat, quiz follow-up), and sub-steps (slide deck images). Maps to provider, model, and workflow. Keys align with `LlmCapabilityKey` except internal-only aliases (e.g. `diagramQuizAgent` inherits `diagramQuiz`). Operation-centric, not output-centric.
_Avoid_: capability (when meaning admin routing), artifact type (when meaning routing), LLM modality (when meaning routing key), GenerationModelMappingKey (deprecated separate enum)

**LLM modality**:
Required input/output lane for a generation route: `text`, `vision`, or `image`. Validates that the chosen provider connection supports the kind — not a routing key.
_Avoid_: capability (when meaning the routing lane), model type, routing lane

**LLM setup route** *(legacy)*:
Deprecated modality-keyed route (`routes.text`, `routes.vision`, `routes.image`). Migration backfill source only — removed from admin UI in Task 14; resolver never reads after backfill.
_Avoid_: provider type mapping, global provider selection

**Generation route**:
One generation kind entry inside an LLM setup. Points to a provider connection, model, required LLM modality, and generation workflow. Every LLM call resolves through a generation route — never through legacy modality routes after migration.
_Avoid_: generation mapping, capability route, LLM setup route

**Generation workflow**:
Orchestration policy on a generation route: `direct` (single-pass provider call) or `agentic` (artifact agent platform — draft, gates, repair/refine loops). Most kinds support `direct` only; `diagramQuiz` requires `agentic`. Screenshot `agentic` ships after Task 14.
_Avoid_: sync mode, inline workflow

**Provider connection**:
Admin-managed connection to an LLM provider, including its credential state, supported LLM modalities, and provider-specific defaults. Each connection has a stable ID (e.g. `gemini-primary`) and a **provider kind** (`gemini`, `openrouter`, or `minimax`). Credentials for all provider kinds are stored encrypted in Firestore — not as deployment secrets.
_Avoid_: provider type (when meaning a configured connection), active provider

**Provider kind**:
The vendor/protocol family of a provider connection (`gemini`, `openrouter`, `minimax`). Distinct from a connection ID: multiple connections could share a kind in the future.
_Avoid_: provider type (prefer **provider kind** on connection documents)

**Generation model usage**:
Structured audit entry recording which generation route handled an LLM call (kind, workflow, provider connection, model, setup). Stored on completed records alongside the compact `generationModel` display label.
_Avoid_: model label (when meaning full audit trail)

## Rules

**Rule**:
User-authored markdown instruction that steers AI behavior for a specific operation (quiz generation, scraping, follow-up chat, etc.). Rules attach to directories and/or are selected explicitly at generation time.
_Avoid_: prompt template, instruction (alone), policy

**Rule applicability**:
Which operation types a rule may apply to (e.g. `quiz`, `diagram_quiz`, `followup`, `subject_world`). A rule can apply to multiple operations.
_Avoid_: rule type, rule category

**Rule resolution mode**:
How explicitly selected rules combine with inherited directory rules: `inherit`, `inherit-plus-explicit`, or `explicit-only`.
_Avoid_: rule merge mode, inheritance setting

**Follow-up rule**:
Rule used for post-generation help — directory chat and per-question follow-up explanations — not for initial artifact content.
_Avoid_: chat rule, explanation rule

## Learning & chat

**Directory chat**:
Conversational assistant scoped to a directory and its documents/artifacts. Uses follow-up rules and artifact context.
_Avoid_: folder chat, library chat

## Relationships

- A **Directory** contains **Documents** and **Artifacts**
- **Artifacts** are generated from one or more **Documents** in the same directory
- **Rules** attach to **Directories** and inherit down the tree
- A **Generation job** drives async completion of every **Pending record** created by AI generation
- A **LLM setup** has one **generation route** per **generation kind**
- A **generation route** points to one **Provider connection** and declares a required **LLM modality**
- Every routed LLM call resolves a **generation route** by **generation kind** (full resolver coverage; legacy modality routes are migration-only)

## Flagged ambiguities

- **Document vs artifact** — both can be AI-generated; "document" means source material, "artifact" means study output. Prompt-generated markdown is a document, not an artifact.
- **Quiz** — used generically in some API paths; prefer the specific kind (diagram quiz, sequence quiz) when the distinction matters.
- **Record vs job** — the user-visible Firestore entity (document/artifact) vs the `GenerationJob` tracking async work; don't conflate their status fields.
