---
description: Firebase Functions v2 callable endpoint patterns
paths:
  - "functions/src/**/*.ts"
---

# Firebase Functions

## Stack

- Firebase Functions v2 (Node.js 22)
- Callable functions consumed by web via RTK Query
- Gemini API via `defineSecret('GEMINI_API_KEY')`
- Shared types from `@shared-types`

## MUST Follow

1. **MUST use `onCall`** for endpoints called from the web app.
2. **MUST validate auth** — check `request.auth` before processing.
3. **MUST return `{ success: boolean, ... }` envelopes** matching web `transformResponse` expectations.
4. **MUST use `defineSecret`** for `GEMINI_API_KEY` — never hardcode API keys.
5. **MUST import types** from `@shared-types` for request/response contracts.
6. **MUST enforce App Check** — global `enforceAppCheck: true` in `functions/src/index.ts`; callable clients must send valid App Check tokens.
7. **MUST keep functions thin** — delegate to services in `functions/src/services/`.

## NEVER Do

- NEVER expose raw Gemini responses without validation
- NEVER store non-serializable data in Firestore documents
- NEVER deploy without building via NX: `yarn nx run functions:build`

## Local Dev

```bash
# functions/.env — GEMINI_API_KEY, STORAGE_BUCKET (copy from functions/.env.example)
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run functions:serve
```

Emulator `--project` MUST match `NX_PUBLIC_FIREBASE_PROJECT_ID`.

## Reference

- [docs/EXTERNAL_API.md](../../docs/EXTERNAL_API.md)
