# Release pipeline

`.github/workflows/release.yml` ships the web app, Cloud Functions, Firestore rules and indexes, and migrations to `study-forge-202604`. The reasoning behind it is in [ADR 009](../../docs/adr/009-llm-proposed-release-plan.md), and the terms are defined under **Release** in `CONTEXT.md`.

| Event | What runs |
|---|---|
| PR → `main` | Plan only. The **Release plan** is posted as a sticky PR comment. |
| push → `main` | test → plan → deploy, unattended |
| `workflow_dispatch` | Same as push. `deploy_all=true` skips the LLM and ships everything. |

## How a plan is made

```
facts.ts  ── deterministic ──►  facts.json  ──►  plan.ts ──►  plan.json / plan.md
   │                                                │
   ├ changed files since last successful release    ├ LLM proposal (Together · MiniMax M3.1 Flash,
   ├ web? nx affected `web` / firebase.json hosting │   @anthropic-ai/sdk → /v1/messages, no tools)
   ├ rules/indexes? file changed                    ├ validateProposal(): allowlists, known names
   ├ per-function import closure (esbuild metafile) │   invalid → errors fed back (3 tries) → still invalid = FAIL
   │   ignoring type-only edits                     └ mergePlan(): deterministic floor ∪ LLM additions
   ├ deployed functions, secrets (gcloud)
   └ Migration ledger + script phase tags
```

| Decision | Who decides |
|---|---|
| Deploy web / rules / indexes | Code |
| Functions: import-graph hits, new exports, force-all | Code (the floor; the LLM can't remove from it) |
| Extra functions the graph can't see | LLM (must be real exports) |
| Public `run.invoker` for new callable/HTTPS functions | Code |
| Other IAM | LLM, limited to `run.invoker`→function, `cloudtasks.enqueuer`→task queue, `pubsub.publisher`→topic, granted to this project's SAs or Google service agents |
| Which migrations run | LLM, only from pending scripts that carry a `@release-phase` tag |
| Migration phase | The script's own tag |
| Deleting functions or indexes, project-level IAM | Nobody. Listed as **manual action needed**. |

**Blockers** fail the release before anything deploys: a secret is missing from Secret Manager for a planned function, or the Migration ledger hasn't been seeded. An LLM failure also fails the release.

## Deploy order

Each step runs only if the previous one succeeded. There's no automatic rollback; re-running the workflow is safe.

1. Rules and indexes. Index builds aren't awaited, and indexes are never deleted.
2. `pre-functions` migrations: dry-run, then `--write`, then the ledger entry.
3. Functions, always as an explicit `--only functions:a,functions:b` list.
4. IAM grants.
5. `post-functions` migrations.
6. Web (Hosting).

## First-time setup

1. `scripts/release/setup-release-identity.sh` (as a project owner). It creates the WIF pool and both service accounts, then prints the `gh variable set` commands.
2. `gh secret set TOGETHER_API_KEY`
3. `TOGETHER_API_KEY=… yarn release:smoke-llm`. This confirms `MiniMaxAI/MiniMax-M3.1-Flash` answers on Together's `/v1/messages`. If it doesn't, set the `RELEASE_LLM_BASE_URL` env in the workflow to a LiteLLM proxy (see Together's docs).
4. `firebase functions:artifacts:setpolicy --project study-forge-202604 --location asia-east1 --days 7`
5. `gcloud auth application-default login && yarn release:seed-ledger --write`
6. Run **Release** manually with `deploy_all=true`. With no earlier successful run there's no base to diff from, so ship everything once.

## Local use

```bash
yarn nx run functions:build
yarn tsx scripts/release/facts.ts --base origin/main --head HEAD --out .release/facts.json --offline
TOGETHER_API_KEY=… yarn tsx scripts/release/plan.ts --facts .release/facts.json --out .release/plan.json --summary .release/plan.md --preview
yarn release:test && yarn release:typecheck
```

`--offline` skips the GCP reads, so "new function" detection and pending migrations are best-effort.
