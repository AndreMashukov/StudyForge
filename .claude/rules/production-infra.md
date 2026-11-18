---
description: Production deployment — Firebase Hosting, GitHub Actions secrets
paths:
  - ".github/workflows/**"
  - "firebase.json"
  - ".firebaserc"
---

# Production Infrastructure

## Release pipeline (web + functions + rules + migrations)

Production deploys via GitHub Actions on push to `main` — see `scripts/release/README.md` and ADR 009:

- Workflow: `.github/workflows/release.yml` (PRs get a plan-only preview comment)
- An LLM proposes the **Release plan**; code validates it; it runs unattended
- Auth: keyless Workload Identity Federation (no service account JSON)
- Build output: `dist/web` (NX `web:build --configuration=production`)
- Firebase project: `study-forge-202604`

## Required GitHub Secrets

| Secret / variable | Purpose |
|--------|---------|
| `TOGETHER_API_KEY` (secret) | Release planner LLM (Together AI, MiniMax M3.1 Flash) |
| `GCP_WIF_PROVIDER` (variable) | Workload Identity Federation provider — from `scripts/release/setup-release-identity.sh` |
| `GCP_RELEASE_SA` (variable) | Deploy service account (main only) |
| `GCP_RELEASE_PREVIEW_SA` (variable) | Read-only planner service account (PR previews + plan job) |
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
| `Failed to authenticate` / `Premature close` on deploy | Keep Node pinned to `22.22.0` — see `skills/firebase-hosting` |
| `google-github-actions/auth` fails | `GCP_WIF_PROVIDER` / `GCP_RELEASE_*SA` variables unset, or the run is not on `refs/heads/main` |
| Release blocked: ledger not seeded | Run `tsx scripts/release/seed-migration-ledger.ts --write` once |
| Release planner LLM failed | Together API down or invalid plan twice — the release aborts by design; re-run the workflow |
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
