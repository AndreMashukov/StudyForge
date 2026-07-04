---
name: firebase-hosting
description: Firebase Hosting production deployment — GitHub Actions, secrets, troubleshooting
---

# Firebase Hosting Deploy

## Workflow

`.github/workflows/firebase-hosting-merge.yml` runs on push to `main`:

1. Lint/test/typecheck affected projects
2. Build web with `NX_PUBLIC_*` secrets injected
3. Deploy via `FirebaseExtended/action-hosting-deploy@v0` to project `study-forge-202604`

## Required GitHub Secrets

```
FIREBASE_SERVICE_ACCOUNT_STUDY_FORGE_202604
NX_PUBLIC_FIREBASE_API_KEY
NX_PUBLIC_FIREBASE_APP_ID
NX_PUBLIC_FIREBASE_AUTH_DOMAIN
NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NX_PUBLIC_FIREBASE_PROJECT_ID
NX_PUBLIC_FIREBASE_STORAGE_BUCKET
NX_PUBLIC_GEMINI_API_KEY
NX_PUBLIC_FIREBASE_APPCHECK_SITE_KEY
```

Verify with: `gh secret list`

## Common Errors

### `Input required: firebaseServiceAccount`

The workflow references a secret that doesn't exist. Must be exactly `FIREBASE_SERVICE_ACCOUNT_STUDY_FORGE_202604`.

### `Failed to authenticate, have you run firebase login?` / `Premature close`

Usually **not** a bad service account secret. Known incompatibility between recent Node.js (22.23+, 24.17+) and firebase-tools 15.22.x's bundled `node-fetch` when exchanging OAuth tokens in CI.

Fix in `.github/workflows/firebase-hosting-merge.yml`:

- Pin `NODE_VERSION` to `22.22.0` (or `24.16.0` if on Node 24)
- Pin `firebaseToolsVersion: '15.21.0'` on the deploy action

Refs: [firebase-tools#10681](https://github.com/firebase/firebase-tools/issues/10681), [nodejs/node#63989](https://github.com/nodejs/node/issues/63989)

### Build works locally but not in CI

CI injects secrets at build time. Missing `NX_PUBLIC_*` secrets → app falls back to demo Firebase config in `web/src/config/firebase.ts`.

### Wrong project deployed

Deploy step uses `projectId: study-forge-202604`. Ensure secrets match this Firebase project.

## Admin (Vercel)

The admin app deploys separately:

- Build: `yarn nx build admin --configuration=production`
- Output: `admin/.next`

## Local Production Build Test

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:build --configuration=production
# Output: dist/web
```

## Reference

- `.claude/rules/production-infra.md`
- `.env.example`
