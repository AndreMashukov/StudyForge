# Release pipeline

`.github/workflows/release.yml` ships the web app, Cloud Functions, Firestore rules and indexes, migrations, and Platform agent knowledge to `study-forge-202604`. The reasoning behind it is in [ADR 009](../../docs/adr/009-llm-proposed-release-plan.md), and the terms are defined under **Release** in `CONTEXT.md`.

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
| Publish and re-index Platform agent knowledge | Code checks whether `docs/workspace-agent-knowledge-base.md` changed and gives the LLM the result for its summary. |
| Functions: import-graph hits, new exports, force-all | Code (the floor; the LLM can't remove from it) |
| Extra functions the graph can't see | LLM (must be real exports) |
| Public `run.invoker` for new callable/HTTPS functions (not for HTTPS functions whose `invoker` option is non-public) | Code |
| Other IAM | LLM, limited to `run.invoker`→function, `cloudtasks.enqueuer`→task queue, `pubsub.publisher`→topic, granted to this project's SAs or its Google service agents. Never `allUsers`. |
| Which migrations run | LLM, only from pending scripts that carry a `@release-phase` tag |
| Migration phase | The script's own tag |
| Deleting functions or indexes, project-level IAM | Nobody. Listed as **manual action needed**. |

**Blockers** fail the release before anything deploys. They include a missing secret for a planned function, an unseeded Migration ledger, or a changed knowledge source that was deleted or emptied. An LLM failure also fails the release.

## Deploy order

Each step runs only if the previous one succeeded. There's no automatic rollback. Re-running the latest run is safe; re-running an older run fails before deploying, because the run for the newer commit covers its changes.

1. Rules and indexes. Index builds aren't awaited, and indexes are never deleted.
2. `pre-functions` migrations: dry-run, then `--write`, then the ledger entry.
3. Functions, always as an explicit `--only functions:a,functions:b` list.
4. IAM grants.
5. `post-functions` migrations.
6. Platform agent knowledge, when `docs/workspace-agent-knowledge-base.md` changed. The release publishes the Markdown to Firestore and waits for `indexPlatformAgentKnowledgeDocument` to index that revision.
7. Web (Hosting).

Knowledge publishing uses the existing document's publisher to resolve the embedding route. Set the Actions variable `RELEASE_WORKSPACE_KNOWLEDGE_USER_ID` for the first publication or to select a different publisher. The user needs a Firestore user group with an `agentKnowledgeEmbedding` route.

## First-time setup

1. `scripts/release/setup-release-identity.sh` (as a project owner). It creates the WIF pool and both service accounts, then prints the `gh variable set` commands.
2. `gh secret set TOGETHER_API_KEY`
3. `TOGETHER_API_KEY=… yarn release:smoke-llm`. This confirms `MiniMaxAI/MiniMax-M3.1-Flash` answers on Together's `/v1/messages`. If it doesn't, set the `RELEASE_LLM_BASE_URL` env in the workflow to a LiteLLM proxy (see Together's docs).
4. `firebase functions:artifacts:setpolicy --project study-forge-202604 --location asia-east1 --days 7`
5. `gcloud auth application-default login && yarn release:seed-ledger --write`
6. Run **Release** manually with `deploy_all=true`. With no earlier successful run there's no base to diff from, so ship everything once. (A push-triggered plan with no successful run on record fails rather than guessing a base.)

The seed refuses to run twice, and refuses while `scripts/migrations/` has uncommitted changes.

## Local use

```bash
yarn nx run functions:build
yarn tsx scripts/release/facts.ts --base origin/main --head HEAD --out .release/facts.json --offline
TOGETHER_API_KEY=… yarn tsx scripts/release/plan.ts --facts .release/facts.json --out .release/plan.json --summary .release/plan.md --preview
yarn release:test && yarn release:typecheck
```

`--offline` skips the GCP reads, so "new function" detection and pending migrations are best-effort.
