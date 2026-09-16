# Workspace agent: platform knowledge evals

v1 scores **Platform agent knowledge** only (published Firestore policy chunks). It does not score **User knowledge** (`search_knowledge`).

Live only. Replay of old traces cannot see today's chunks. Two experiments share one dataset so LangSmith can compare rows by example.

## Dataset

LangSmith name: `Workspace Agent: Platform Knowledge`

Local file: `scripts/langsmith-eval/datasets/workspace-agent-platform-knowledge.json`

Ten non-mutating cases (`WA-PK-01` … `WA-PK-10`): credit table lookups, refuse diagram/slide/sequence, clarify “make me a course”, refuse HTML in chat, 100-credit auto cap, flashcard source-document cap.

Do not mix these into `Workspace Agent: Final Response`.

## Pin

Both experiments read `platformAgentKnowledgeDocuments/workspace-agent-knowledge-base` at start. The run fails if status is not `published` / `indexed`. Experiment metadata includes:

- `platformKnowledgeDocumentId`
- `publishedContentHash`

If you edit `docs/workspace-agent-knowledge-base.md` and re-seed, the hash changes. Scores can move even if the agent did not.

## Commands

Emulators must already be running (`--project` matching `NX_PUBLIC_FIREBASE_PROJECT_ID`). Seed indexes the knowledge file (setup step 9).

```bash
npx tsx scripts/seed-setup/setup-seed-data.ts
npx tsx scripts/langsmith-eval/datasets/upload-platform-knowledge.ts
npx tsx --tsconfig tsconfig.base.json scripts/langsmith-eval/experiments/run-platform-knowledge-retrieval.ts
npx tsx --tsconfig tsconfig.base.json scripts/langsmith-eval/experiments/run-platform-knowledge-application.ts
```

Smoke: `LANGSMITH_EVAL_MAX_EXAMPLES=2` on either runner.

Retrieval and application scripts import `PlatformAgentKnowledgeIndexService`, so they need `--tsconfig tsconfig.base.json` (workspace path aliases). Upload does not.

### Retrieval (`workspace-agent-pk-retrieval-v1`)

Calls `searchPlatformKnowledge` with the seed user. Returns `{ retrievedTexts, documentId, publishedContentHash }`.

Metric: `retrieval_recall` = (expected phrases found in chunk text) / (phrases listed). Score 0 if phrases are required and zero chunks return.

### Application (`workspace-agent-pk-application-v1`)

HTTP to emulator `agentMessageStream` (same client as final-response live). Metric: `policy_facts` (all `mustContain`, no `mustNotContain`) on `finalReply`.

Emulator only. No GLM-5.2 `criteria_match` on this dataset.

## Later

Same-turn `{ finalReply, retrievedTexts }` plus four RAG LLM-as-judge columns: see [next-steps.md](next-steps.md) section 8.
