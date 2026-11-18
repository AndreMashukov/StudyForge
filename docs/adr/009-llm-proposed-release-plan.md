# ADR 009: An LLM proposes the Release plan; code validates it; it runs unattended

## Status

Accepted (2026-11-18)

## Context

Functions were deployed by hand, and CI only deployed Hosting. All functions ship in one esbuild bundle, so a bundle hash can't say which functions changed. Releases sometimes need more than code: Firestore indexes, a Cloud Run invoker grant for a new callable (missing grants caused the `FirebaseError: internal` outage in `FIREBASE_FUNCTIONS_V2_IAM_FIX.md`), or a backfill script from `scripts/migrations/`. Nothing recorded which of those scripts had already run.

## Decision

`.github/workflows/release.yml` builds a **Release plan** in two halves:

- **Deterministic facts**: web vs. functions (nx affected), rules and index file changes, and each function export's import closure. The closure comes from the esbuild metafile and ignores type-only edits. Code also reads the deployed functions, the secrets, and the **Migration ledger**.
- **LLM proposal**: MiniMax M3.1 Flash on Together AI, called through `@anthropic-ai/sdk` against Together's Anthropic-compatible `/v1/messages`. It is one call with no tools, and it may only *add*: extra functions, allowlisted resource-level IAM grants, and which tagged pending migrations to run.

Code validates the proposal against allowlists and merges it with the deterministic floor. The LLM can't remove a graph-affected function, choose a migration's **Release phase**, or issue a free-form command. The result runs **unattended** in a fixed order: rules/indexes (not awaited) → pre-functions migrations → functions → IAM → post-functions migrations → web.

## Considered Options

- **LLM decides everything from the diff**: rejected. A hallucinated "web only" would silently skip a functions deploy.
- **Claude Agent SDK with read-only tools**: rejected in favour of a single Messages call. It is cheaper and simpler, and the deterministic facts carry what the model would otherwise read.
- **Approval gate before `--write` migrations**: rejected. Releases are fully unattended. Safety comes from the Migration ledger (a script runs at most once), from phase tags in the scripts, and from the mandatory dry-run before `--write`.
- **Deterministic fallback when the LLM fails**: rejected. If the planner fails or returns an invalid plan twice, the release fails and nothing deploys.
- **Long-lived service account key**: rejected for Workload Identity Federation. The deploy SA trusts only `refs/heads/main`, and a separate read-only SA serves planning and PR previews.

## Consequences

- A Together outage blocks every release, web-only ones included. `workflow_dispatch` with `deploy_all=true` skips the LLM.
- The pipeline never deletes functions or indexes and never grants project-level IAM. These appear in the plan as manual actions.
- Any change to a shared dependency (root `package.json`, `yarn.lock`, `tsconfig.base.json`, or a file `index.ts` imports first) deploys all functions.
- Index builds aren't awaited, so a new query can fail with `FAILED_PRECONDITION` for a few minutes after a release.
- Each migration script declares `@release-phase pre-functions|post-functions`. Untagged scripts never run automatically.
