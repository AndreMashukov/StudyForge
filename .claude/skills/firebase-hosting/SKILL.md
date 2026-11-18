---
name: firebase-hosting
description: Firebase Hosting production deployment — GitHub Actions, secrets, troubleshooting
---

# Firebase Hosting Deploy

## Workflow

`.github/workflows/release.yml` runs on push to `main` (full design: `scripts/release/README.md`):

1. Lint/test/typecheck affected projects
2. Plan: deterministic facts + LLM proposal → validated Release plan
3. Deploy in order: rules/indexes → pre-functions migrations → functions → IAM → post-functions migrations → web

Web deploys only when nx marks `web` affected (or the `firebase.json` hosting section changed), via the Firebase CLI with WIF credentials.

## Required GitHub Secrets

```
TOGETHER_API_KEY                 # secret
GCP_WIF_PROVIDER                 # variable (gh variable list)
GCP_RELEASE_SA                   # variable
GCP_RELEASE_PREVIEW_SA           # variable
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

### `google-github-actions/auth` fails

The WIF variables are unset, or the run is not on `refs/heads/main` (the deploy SA trusts only main). Re-run `scripts/release/setup-release-identity.sh` and set the printed variables.

### `Failed to authenticate, have you run firebase login?` / `Premature close`

Usually **not** a bad service account secret. Known incompatibility between recent Node.js (22.23+, 24.17+) and firebase-tools 15.22.x's bundled `node-fetch` when exchanging OAuth tokens in CI.

Fix in `.github/workflows/release.yml`:

- Pin `NODE_VERSION` to `22.22.0` (or `24.16.0` if on Node 24)
- Keep the repo's `firebase-tools` devDependency below 15.22.x

Refs: [firebase-tools#10681](https://github.com/firebase/firebase-tools/issues/10681), [nodejs/node#63989](https://github.com/nodejs/node/issues/63989)

### Build works locally but not in CI

CI injects secrets at build time. Missing `NX_PUBLIC_*` secrets → app falls back to demo Firebase config in `web/src/config/firebase.ts`.

### Wrong project deployed

Release scripts use `RELEASE_FIREBASE_PROJECT` (default `study-forge-202604`). Ensure secrets match this Firebase project.

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
