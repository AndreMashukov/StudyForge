---
description: Firebase Functions v2 callable endpoint patterns
paths:
  - "functions/src/**/*.ts"
  - "libs/backend/**/*.ts"
---

# Firebase Functions

## Stack

- Firebase Functions v2 (Node.js 22), region `asia-east1`
- Callable functions consumed by web via RTK Query
- Gemini via `defineSecret('GEMINI_API_KEY')`
- Shared types from `@shared-types`
- Domain services in `@study-forge/backend-*` libraries under `libs/backend/`

## MUST Follow

1. **MUST use `onCall`** for endpoints called from the web app.
2. **MUST validate auth** — check `request.auth` before processing (`@study-forge/backend-core/lib/auth`).
3. **MUST return `{ success: boolean, ... }` envelopes** matching web `transformResponse`.
4. **MUST use `defineSecret`** for `GEMINI_API_KEY` — never hardcode.
5. **MUST enforce App Check** — global `enforceAppCheck: true` in `functions/src/index.ts`.
6. **MUST keep functions thin** — delegate to `@study-forge/backend-*` libraries, not inline domain logic in endpoints.
7. **MUST use static imports** for backend libs in endpoints (no mixed dynamic/static imports of the same lib — Nx lint).

## Backend library map

| Concern | Library |
|---------|---------|
| Auth, paths, rate limits, telemetry | `@study-forge/backend-core` |
| LLM / Gemini | `@study-forge/backend-llm` |
| Generation jobs / processors | `@study-forge/backend-generation` |
| Documents / uploads / URLs | `@study-forge/backend-documents` |
| Directories / rules | `@study-forge/backend-directories` |
| Artifacts (quiz, flashcards, slides, …) | `@study-forge/backend-artifacts` |

## NEVER Do

- NEVER import `@study-forge/backend-*` from `web` or `admin`
- NEVER expose raw Gemini responses without validation
- NEVER deploy without building via NX: `yarn nx run functions:build`

## Local Dev

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run functions:serve
```

Emulator `--project` MUST match `NX_PUBLIC_FIREBASE_PROJECT_ID`.

## Reference

- [docs/adr/001-backend-nx-libraries.md](../../docs/adr/001-backend-nx-libraries.md)
- [docs/EXTERNAL_API.md](../../docs/EXTERNAL_API.md)
