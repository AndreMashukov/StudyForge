# shared-types — StudyForge

Cross-boundary TypeScript contracts for `web`, `admin`, and `functions`. Import as `@shared-types`.

## Must Follow

- Prefer extending existing types over creating duplicates in `web/src/types/`
- Re-export public API from `src/index.ts`
- Keep types serializable for Redux / Firestore (no class instances, Maps, Sets)
- Breaking changes affect callables and clients — update both sides in the same change

## Commands

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run shared-types:build
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run shared-types:lint
```

## Never

- Never put React or Firebase Admin runtime code here
- Never import `@study-forge/backend-*` into this library
