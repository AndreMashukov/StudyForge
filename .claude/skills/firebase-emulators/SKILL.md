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
| `functions/.secret.local` | Emulator secrets for `defineSecret()` (copy from `functions/.secret.local.example`) |

Set `NX_PUBLIC_USE_FIREBASE_EMULATOR=true` for local dev.

## App Check (required for callables)

Functions enforce App Check globally (`enforceAppCheck: true`). The web app must initialize App Check in production and emulator modes.

1. Create a reCAPTCHA v3 site key and register the web app in Firebase Console → App Check.
2. Set `NX_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` in root `.env` / CI secrets.
3. **Emulator:** the web client enables debug tokens automatically. Copy the debug token from the browser console and register it in Firebase Console → App Check → Manage debug tokens. Optionally set a fixed `NX_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN` in `.env.local` so the token does not change between reloads.
4. **Emulator enforcement:** callable App Check enforcement is disabled while `functions:serve` runs (`FUNCTIONS_EMULATOR=true`). Production deploys still enforce App Check.
5. **Production Console rollout:** enable App Check metrics first (monitor), then enforce for Firestore/Storage when ready. Callable enforcement is active in deployed functions.

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
