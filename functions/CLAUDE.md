# functions — StudyForge

Firebase Functions v2 (Node 22), region `asia-east1`. Callables consumed by web via RTK Query.

## Commands

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run functions:lint
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run functions:build
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run functions:serve
```

Deploy only when explicitly requested: `yarn nx run functions:deploy`.

## Must Follow

- Thin `onCall` endpoints — domain logic in `@study-forge/backend-*`
- Validate `request.auth`; return `{ success: boolean, ... }` envelopes
- `defineSecret('GEMINI_API_KEY')` — never hardcode
- Shared contracts from `@shared-types`
- Emulator `--project` MUST match `NX_PUBLIC_FIREBASE_PROJECT_ID`

## Backend libs

| Concern | Package |
|---------|---------|
| Auth, paths, rate limits | `@study-forge/backend-core` |
| Gemini / LLM | `@study-forge/backend-llm` |
| Generation jobs | `@study-forge/backend-generation` |
| Documents | `@study-forge/backend-documents` |
| Directories / rules | `@study-forge/backend-directories` |
| Artifacts | `@study-forge/backend-artifacts` |

Never import `@study-forge/backend-*` from `web` or `admin`.

## LangGraph pipeline (diagram-quiz)

`generateDiagramQuiz` runs the **LangGraph** pipeline at `@study-forge/backend-artifacts/artifact-agent-langgraph` (strangler-fig replacement for the ADK pipeline). `processGenerationJob` and other artifact kinds (`flashcards`, etc.) still use the ADK pipeline at `@study-forge/backend-artifacts/artifact-agent`. The dispatcher at `libs/backend/generation/src/generation-processors/artifact-agent.ts` is the single switch point.

**Before any change under `libs/backend/artifacts/src/artifact-agent-langgraph/**` or `libs/backend/artifacts/src/diagram-quiz/**`, read `.claude/rules/langgraph-artifact-pipeline.md`.** CI runs esbuild, not `tsc` — verify with `tsc -p functions/tsconfig.json --noEmit` locally before pushing.

## Reference

- Path rule: `.claude/rules/firebase-functions.md`
- ADR: `docs/adr/001-backend-nx-libraries.md`
- Agent: `functions-reviewer`
