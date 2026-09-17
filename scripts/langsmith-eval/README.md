# LangSmith eval scripts

Layout follows LangSmith's three pieces: **datasets**, **evaluators**, **run functions** (`targets`), then **experiments** that call `evaluate()`.

```
scripts/langsmith-eval/
  datasets/       labeled JSON + upload scripts
  evaluators/     one metric per function; hosted LLM-as-judge config
  targets/        how to produce outputs (search, live agent, replay)
  experiments/    evaluate() entrypoints
  shared/         env, constants, live HTTP client
```

## Commands

Final response (replay old traces):

```bash
npx tsx scripts/langsmith-eval/datasets/upload-final-response.ts
npx tsx scripts/langsmith-eval/experiments/run-final-response-replay.ts
```

Final response (live agent):

```bash
npx tsx scripts/langsmith-eval/experiments/run-final-response-live.ts
```

Platform knowledge (code + RAG LLM judges):

```bash
# Set LANGSMITH_EVAL_EMIT_RETRIEVED_TEXTS=true in functions/.env.local, rebuild functions.
npx tsx scripts/langsmith-eval/datasets/upload-platform-knowledge.ts
npx tsx --tsconfig tsconfig.base.json scripts/langsmith-eval/experiments/run-platform-knowledge-retrieval.ts
npx tsx --tsconfig tsconfig.base.json scripts/langsmith-eval/experiments/run-platform-knowledge-application.ts
```

Retrieval: `retrieval_recall` only. How that experiment works: [docs/langsmith/workspace-agent-platform-knowledge-retrieval.md](../../docs/langsmith/workspace-agent-platform-knowledge-retrieval.md). Application: `policy_facts` plus four RAG judges (`correctness`, `relevance`, `groundedness`, `retrieval_relevance`). Needs `TOGETHER_AI_API_KEY`.

Smoke: `LANGSMITH_EVAL_MAX_EXAMPLES=2`.

Hosted Python code evals: `evaluators/final-response.py`. Hosted GLM-5.2 judge files: `evaluators/llm-judge/`. Local RAG judges: `evaluators/rag-llm-judges.ts`.
