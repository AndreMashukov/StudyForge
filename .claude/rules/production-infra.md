---
description: Production deployment — Firebase Hosting, GitHub Actions secrets
paths:
  - ".github/workflows/**"
  - "firebase.json"
  - ".firebaserc"
---

# Production Infrastructure

## Firebase Hosting Deploy

Production deploys via GitHub Actions on push to `main`:

- Workflow: `.github/workflows/firebase-hosting-merge.yml`
- Action: `FirebaseExtended/action-hosting-deploy@v0`
- Build output: `dist/web` (NX `web:build --configuration=production`)
- Firebase project: `study-forge-202604`

## Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `FIREBASE_SERVICE_ACCOUNT_STUDY_FORGE_202604` | Firebase Admin SDK JSON for deploy auth |
| `NX_PUBLIC_FIREBASE_API_KEY` | Client Firebase config |
| `NX_PUBLIC_FIREBASE_APP_ID` | Client Firebase config |
| `NX_PUBLIC_FIREBASE_AUTH_DOMAIN` | Client Firebase config |
| `NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Client Firebase config |
| `NX_PUBLIC_FIREBASE_PROJECT_ID` | Client Firebase config + deploy `projectId` |
| `NX_PUBLIC_FIREBASE_STORAGE_BUCKET` | Client Firebase config |
| `NX_PUBLIC_GEMINI_API_KEY` | Client-side Gemini access |
| `NX_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` | reCAPTCHA v3 site key for App Check (required for callable functions) |

**Never commit** service account JSON or API keys to the repository.

## Admin Deploy (Vercel)

The `admin` app deploys separately to Vercel:

- Build: `yarn nx build admin --configuration=production`
- Output: `admin/.next`
- Optional ignored build step: `npx nx-ignore admin`

## Common Deploy Failures

| Error | Fix |
|-------|-----|
| `Failed to authenticate` / `Premature close` on deploy | Pin Node to `22.22.0` and `firebaseToolsVersion: '15.21.0'` — see `skills/firebase-hosting` |
| `Input required: firebaseServiceAccount` | Secret name mismatch — must be `FIREBASE_SERVICE_ACCOUNT_STUDY_FORGE_202604` |
| CORS 404 on callable functions | Emulator/deploy `--project` does not match `NX_PUBLIC_FIREBASE_PROJECT_ID` |
| Build succeeds but app shows demo config | `NX_PUBLIC_*` secrets missing in the build step env block |

## Post-Deploy Validation

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:typecheck
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:lint
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:build
```

## Reference

- `skills/firebase-hosting` — deploy troubleshooting guide
- [.env.example](../../.env.example)
- [admin/.env.example](../../admin/.env.example)
