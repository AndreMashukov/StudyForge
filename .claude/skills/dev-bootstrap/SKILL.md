---
name: dev-bootstrap
description: Bring up a complete local dev environment — init env + deps, start Firebase emulators, seed test data, and run the web app
effort: high
allowed-tools: Bash
argument-hint: [project-id]
---

# Dev Bootstrap

Bring up the full local dev stack in this worktree, in order: env init → functions build → emulators → seed → web dev.

Default project ID: `study-forge-202604` (matches the fallback in `web/src/config/firebase.ts`). Override via `$ARGUMENTS` (e.g. `/dev-bootstrap my-other-project`).

## Steps

### 1. Initialize env + deps

Skip if `.env` already exists.

```bash
./scripts/setup-worktree.sh
```

Installs root + `functions/` dependencies, creates `.env` / `.env.local` from `.env.example` if missing.

### 2. Write `web/.env`

Vite reads `web/.env` only — not the root `.env`. Skip if the file already exists.

```bash
PROJECT_ID="${1:-study-forge-202604}"
cat > web/.env <<EOF
NX_PUBLIC_FIREBASE_PROJECT_ID=$PROJECT_ID
NX_PUBLIC_FIREBASE_AUTH_DOMAIN=$PROJECT_ID.firebaseapp.com
NX_PUBLIC_FIREBASE_STORAGE_BUCKET=$PROJECT_ID.appspot.com
NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=853327102927
NX_PUBLIC_FIREBASE_APP_ID=1:853327102927:web:4a3444a27948fac44088ba
NX_PUBLIC_FIREBASE_API_KEY=demo-api-key-for-emulator
NX_PUBLIC_USE_FIREBASE_EMULATOR=true
EOF
```

### 3. Build functions

Skip if `functions/lib/index.js` already exists.

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run functions:build
```

### 4. Start Firebase emulators (background)

```bash
PROJECT_ID="${1:-study-forge-202604}"
yarn firebase emulators:start --project "$PROJECT_ID"
```

Wait for `✔ All emulators ready!` (~20 s) before continuing. Watch out for the "outdated `firebase-functions`" warning — pre-existing, safe to ignore.

### 5. Seed test data

```bash
npx tsx scripts/seed-setup/setup-seed-data.ts
```

Creates user `test@example.com / Test123456!` (with `{"role": "admin"}` custom claim), a "Study Materials" directory, a "General Study Rule" prompt rule, four sample documents (`perfect-doc-ml`, `doc-ruby-vs-js`, `doc-system-design`, `doc-react-patterns`), and storage content for the ML doc.

### 6. Start web dev server (background)

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:dev
```

Vite serves on http://localhost:4200.

## Report

When all steps complete, report:

- **Web app:** http://localhost:4200
- **Emulator UI:** http://127.0.0.1:4000
- **Login:** `test@example.com` / `Test123456!` (admin)
- **Background tasks:** list the emulator and dev server task IDs so the user can stop them later

## Critical Gotcha

The `--project` value passed to `firebase emulators:start` MUST match the project ID in `web/.env`. A mismatch causes CORS 404 on callable function preflight, and every cloud function call fails.

## Tear Down

```bash
pkill -f "nx run web:dev"      # stop web
pkill -f "firebase emulators"  # stop emulators
```

## Reference

- [firebase-emulators](../firebase-emulators/SKILL.md) — emulator details
- [worktree-create](../worktree-create/SKILL.md) — worktree creation
- [scripts/QUICK_SETUP.md](../../../scripts/QUICK_SETUP.md) — quick start guide
