---
name: firebase-emulators
description: Local Firebase emulator setup for StudyForge — Auth, Firestore, Functions, Storage, seed data
---

# Firebase Emulators

## Start Emulators

```bash
# Via NX (builds functions first)
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run functions:serve

# Or directly (project MUST match NX_PUBLIC_FIREBASE_PROJECT_ID)
yarn firebase emulators:start --project "$NX_PUBLIC_FIREBASE_PROJECT_ID"
```

## Ports

| Service | Port |
|---------|------|
| Auth | 9099 |
| Firestore | 8080 |
| Functions | 5001 |
| Storage | 9199 |
| Hosting | 5002 |
| Emulator UI | 4000 |

## Environment Files

| File | Purpose |
|------|---------|
| Root `.env` | `NX_PUBLIC_*` vars for Vite |
| `web/.env` | Vite `import.meta.env` exposure |
| `admin/.env.local` | Next.js public + server secrets |
| `functions/.env` | `GEMINI_API_KEY`, `STORAGE_BUCKET` |
| `functions/.env.local` | Storage bucket `.appspot.com` form for emulator |

Set `NX_PUBLIC_USE_FIREBASE_EMULATOR=true` for local dev.

## Seed Test Data

Emulators start empty. With emulators running:

```bash
npx tsx scripts/seed-setup/setup-seed-data.ts
```

Creates `test@example.com` / `Test123456!` and a sample "Machine Learning" document.

## Dev Servers

```bash
# Web SPA
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:dev
# http://localhost:4200

# Admin (Next.js)
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run admin:dev
# http://localhost:4201
```

## Critical Gotcha

Emulator `--project` **MUST** match `NX_PUBLIC_FIREBASE_PROJECT_ID`. Mismatch causes CORS 404 on callable function preflight.

## Reference

- [scripts/ENV_SETUP.md](../../scripts/ENV_SETUP.md)
- [scripts/QUICK_SETUP.md](../../scripts/QUICK_SETUP.md)
