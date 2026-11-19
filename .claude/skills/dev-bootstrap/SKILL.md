---
name: dev-bootstrap
description: Bring up a complete local dev environment — init env + deps, start Firebase emulators, seed test data, and run the web app. Use in Claude Code when the user wants local web + functions emulators.
effort: high
allowed-tools: Bash
argument-hint: [project-id]
---

# Dev Bootstrap

Bring up **web** (`:4200`) plus **Firebase emulators** (functions, Firestore, Auth, Storage) in this worktree. Do not start admin, deploy hosting, or deploy functions.

Default project ID: `study-forge-202604` (matches the fallback in `web/src/config/firebase.ts`). Override via `$ARGUMENTS` (e.g. `/dev-bootstrap my-other-project`).

Set `PROJECT_ID` to `$ARGUMENTS` when non-empty, else `study-forge-202604`. Run every step from the **active worktree root**. Skip a step when its outcome is already present.

## Claude Code rules

- **Never use the Write/Edit tool** for `.env`, `web/.env`, or `functions/.env`. The `block-secrets` hook denies those. Create or copy env files only with Bash redirects or `cp`.
- **Emulators and Vite never exit.** Start them as **background** Bash tasks. Wait by reading task output until the ready line appears. Do not block on the process exiting.
- **Match project IDs.** The `--project` flag on `firebase emulators:start` MUST equal `NX_PUBLIC_FIREBASE_PROJECT_ID` in `web/.env`. A mismatch causes CORS 404 on callable preflight.
- **No broad `pkill`** for tear-down. Stop the specific background task IDs you started.

## Steps

### 1. Dependencies and root env

If `node_modules/nx/package.json` or root `.env` is missing:

```bash
./scripts/setup-worktree.sh
```

Installs dependencies and creates root `.env` / `.env.local` from examples when missing.

### 2. `web/.env` (Vite only)

Skip if `web/.env` already exists. Vite reads **`web/.env` only**, not the root `.env`.

**Use Bash only** (not Write):

```bash
PROJECT_ID="study-forge-202604"  # or value from $ARGUMENTS
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

### 3. `functions/.env`

Skip if `functions/.env` already exists.

**Use Bash only:**

```bash
cp functions/.env.example functions/.env
# Ensure STORAGE_BUCKET matches the emulator bucket form:
# STORAGE_BUCKET=<PROJECT_ID>.appspot.com
```

If the user has no real `GEMINI_API_KEY` in `functions/.env`, report that **AI generation callables need a real key**. Login, library, and non-AI paths can still work on emulators. Do not invent API keys.

### 4. Java (Firestore emulator)

Require `java` on PATH (JDK 21+). If missing, **stop** and tell the user the Firestore emulator needs Java.

### 5. Port check (avoid duplicate stacks)

If ports **4000** (emulator UI), **5001** (functions), or **4200** (web) are already in use, do not start a second copy. Report what is already listening and skip the matching start step.

### 6. Build functions

Skip if built output exists (e.g. `functions/lib/src/index.js`).

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run functions:build
```

### 7. Start Firebase emulators (background)

```bash
PROJECT_ID="study-forge-202604"  # or value from $ARGUMENTS
yarn firebase emulators:start --project "$PROJECT_ID"
```

Run in **background**. Poll task output until you see **`All emulators ready`** (often ~20 s). The outdated `firebase-functions` warning is pre-existing and safe to ignore.

Prefer this command over `functions:serve` so `--project` always matches `web/.env`.

### 8. Seed test data

With emulators ready:

```bash
npx tsx scripts/seed-setup/setup-seed-data.ts
```

Creates user `test@example.com` / `Test123456!` (admin claim), sample directory, rule, and documents (including `perfect-doc-ml`).

### 9. Start web dev server (background)

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:dev
```

Run in **background**. Poll until the log shows **`http://localhost:4200`**.

## Report

When done (or when skipping steps because services are already up), report:

- **Web app:** http://localhost:4200
- **Emulator UI:** http://127.0.0.1:4000
- **Login:** `test@example.com` / `Test123456!` (admin)
- **Background tasks:** emulator and web dev task IDs so the user can stop them later
- **GEMINI_API_KEY:** remind if still placeholder and generation is needed

## Tear down

Stop the background tasks you started (emulators, `web:dev`). Do not use `pkill` across the machine unless the user explicitly asks.

## Reference

- [firebase-emulators](../firebase-emulators/SKILL.md) — ports, App Check, secrets
- [worktree-create](../worktree-create/SKILL.md) — parallel worktrees
- [scripts/QUICK_SETUP.md](../../../scripts/QUICK_SETUP.md) — quick start guide