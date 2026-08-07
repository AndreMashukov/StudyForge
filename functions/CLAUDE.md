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

## Reference

- Path rule: `.claude/rules/firebase-functions.md`
- ADR: `docs/adr/001-backend-nx-libraries.md`
- Agent: `functions-reviewer`
