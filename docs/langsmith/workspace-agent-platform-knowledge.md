# Workspace agent: platform knowledge evals

Scores **Platform agent knowledge** only (published Firestore policy chunks). It does not score **User knowledge** (`search_knowledge`).

How the retrieval-only experiment searches, chunks, and scores `retrieval_recall`: [workspace-agent-platform-knowledge-retrieval.md](workspace-agent-platform-knowledge-retrieval.md).

Live only. Replay of old traces cannot see today's chunks. Two experiments share one dataset so LangSmith can compare rows by example.

## Dataset

LangSmith name: `Workspace Agent: Platform Knowledge`

Local file: `scripts/langsmith-eval/datasets/workspace-agent-platform-knowledge.json`

Ten non-mutating cases (`WA-PK-01` … `WA-PK-10`): credit table lookups, refuse diagram/slide/sequence, clarify "make me a course", refuse HTML in chat, 100-credit auto cap, flashcard source-document cap.

Each example has:

- `inputs.objective`
- `outputs.expectedChunkPhrases` (retrieval phrase gate)
- `outputs.mustContain` / `outputs.mustNotContain` (policy code gate)
- `outputs.finalReply` (gold criteria for the correctness judge)

Do not mix these into `Workspace Agent: Final Response`.

## Pin

Both experiments read `platformAgentKnowledgeDocuments/workspace-agent-knowledge-base` at start. The run fails if status is not `published` / `indexed`. Experiment metadata includes:

- `platformKnowledgeDocumentId`
- `publishedContentHash`

If you edit `docs/workspace-agent-knowledge-base.md` and re-seed, the hash changes. Scores can move even if the agent did not.

## Setup for RAG application eval

1. Emulators running (`--project` matching `NX_PUBLIC_FIREBASE_PROJECT_ID`).
2. Seed: `npx tsx scripts/seed-setup/setup-seed-data.ts`
3. In `functions/.env.local`: `LANGSMITH_EVAL_EMIT_RETRIEVED_TEXTS=true`
4. Rebuild and restart functions (`yarn nx run functions:serve`).
5. `TOGETHER_AI_API_KEY` in root `.env.local` for the four LLM judges.

When the flag is on, `agentMessageStream` `done.response` includes `retrievedTexts`: the platform-knowledge chunk texts the planner saw on that turn. Default off in production.

## Commands

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

Cheap phrase gate only. Not the tutorial LLM retrieval-relevance judge. Detail: [workspace-agent-platform-knowledge-retrieval.md](workspace-agent-platform-knowledge-retrieval.md).

### Application / RAG (`workspace-agent-pk-rag-v1`)

HTTP to emulator `agentMessageStream`. Returns `{ finalReply, retrievedTexts }` from the same turn.

| Metric | Type | Compares |
| --- | --- | --- |
| `policy_facts` | code | `finalReply` vs `mustContain` / `mustNotContain` |
| `correctness` | Together GLM-5.2 | `finalReply` vs gold `outputs.finalReply` |
| `relevance` | Together GLM-5.2 | `finalReply` vs `objective` |
| `groundedness` | Together GLM-5.2 | `finalReply` vs same-turn `retrievedTexts` |
| `retrieval_relevance` | Together GLM-5.2 | `retrievedTexts` vs `objective` |

Prompts follow the [LangSmith RAG tutorial](https://docs.langchain.com/langsmith/evaluate-rag-tutorial). Judges run locally in `evaluate()` (not hosted dataset rules). The Together GLM-5.2 call disables thinking (`reasoning.enabled=false` and `thinking.type=disabled`) and requests structured JSON (`json_schema`, with `json_object` if the schema format is rejected). The grade boolean or `score` is first; `explanation` / `comment` is one or two sentences.

Emulator only. The run fails if `retrievedTexts` is missing on `done.response` (functions not rebuilt with the emit flag).

Keep `policy_facts` and `retrieval_recall` as cheap gates. A high judge score with a failed `policy_facts` still means a required fact was missed (for example "20").

Do not attach these judges as online evals on production `workspace-agent` traces.
