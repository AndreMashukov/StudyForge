# Workspace agent LLM-as-judge

This document records how StudyForge implemented the **hosted** LangSmith LLM-as-judge for the workspace agent, plus the **local** twin in the replay script. It is not a general LangSmith tutorial.

How to run experiments, upload the dataset, and attach code evaluators: [langsmith-workspace-agent-experiments.md](langsmith-workspace-agent-experiments.md). Browser labeling: [qa-workspace-agent-browser.md](qa-workspace-agent-browser.md). Domain terms (workspace agent, artifact, directory chat): [CONTEXT.md](../../CONTEXT.md).

## What it grades

The dataset is **Workspace Agent: Final Response** (id `cd29f180-cfb3-4162-97cd-59cc6a8fa210`).

Each example has:

- `inputs.objective`: the user prompt from QA
- `outputs.finalReply`: **gold criteria** (what a good reply must do), not a verbatim dump of the agent
- optional `outputs.mustNotContain`: canned planner fallback string (used by code evals, not by this judge)

The experiment target returns `{ "finalReply": "<text from the labeled trace>" }`. The judge compares that actual reply to the gold criteria.

This is a **final_response** eval. It does not score tool trajectories.

The judge is **one metric**: pass or fail on criteria match. Code evaluators already cover nonempty reply and canned fallback. Do not fold those checks into this prompt.

## Hosted vs local

There are two LLM judges. They use the same Together model. They are not the same column.

| Where | Column name in LangSmith | How it runs |
| --- | --- | --- |
| Hosted dataset rule **Workspace Agent Criteria Match** | `score` (boolean) and `comment` | LangSmith calls Together after each experiment run. You do not pass this evaluator into `evaluate()`. |
| Local function in `evaluators/local-criteria-match.ts` | `criteria_match` (0 or 1) | The replay/live scripts POST to Together and return `{ key, score, comment }`. |

The CLI printout lists only local keys (`no_canned_fallback`, `nonempty_reply`, `criteria_match`). Open the experiment compare view to see hosted `score`.

They can disagree. Hosted uses a StructuredPrompt plus JSON schema. Local asks for `{"score": 0 or 1, "comment": "..."}` and recovers truncated JSON. Same model, different wrapping.

## Files in the repo

All hosted config lives under `scripts/langsmith-eval/evaluators/llm-judge/`.

| File | Role |
| --- | --- |
| `prompt.json` | Judge messages. Mustache vars `{{input}}`, `{{reference}}`, `{{output}}`. CLI format: list of `[role, content]`. |
| `schema.json` | Structured output: boolean `score`, string `comment`. Each top-level key becomes a LangSmith feedback column. |
| `model.json` | Serialized LangChain `ChatOpenAI` pointing at Together GLM-5.2. |
| `variable-mapping.json` | Maps prompt vars to experiment / example fields. |

Local judge: `gradeCriteriaMatch` in `scripts/langsmith-eval/evaluators/local-criteria-match.ts` (`https://api.together.xyz/v1/chat/completions`, model `zai-org/GLM-5.2`).

## LangSmith objects (this workspace)

| Object | Value |
| --- | --- |
| Dataset | `Workspace Agent: Final Response` |
| Rule display name | `Workspace Agent Criteria Match` |
| Rule id | `648e559e-c444-4850-8e2c-76a3ab6f56e1` |
| Evaluator id | `5438533e-8d9d-4ad9-b521-6be1377f9ac5` |
| Hub prompt (current) | `eval_workspace_agent_final_response_workspace_agent_criteria_match_939e0f7a:latest` |
| Sampling | 1.0, enabled, dataset-attached (offline) |
| Model | Together `zai-org/GLM-5.2` |
| Base URL | `https://api.together.xyz/v1` |
| Workspace secret name | `TOGETHER_AI_API_KEY` (same value as `.env.local`, never commit it) |

`langsmith evaluator get` shows mapping and hub ref. It does **not** dump a full `model.json`. Keep `model.json` in git as the source of truth for recreate.

## Prompt

System: pass if the actual reply meets gold criteria. Partial-but-honest answers can pass. Fail if the reply invents ids, creates a forbidden artifact kind, uses the canned planner fallback, or misses the required behavior.

Human template:

```text
User objective:
{{input}}

Expected criteria:
{{reference}}

Actual finalReply:
{{output}}
```

Gold `outputs.finalReply` in the JSON dataset is criteria text (for example “honest empty-index, do not invent quotes”). The judge must not treat that string as the only acceptable wording.

## Schema

```json
{
  "title": "Grade",
  "type": "object",
  "properties": {
    "score": { "type": "boolean", "description": "True if the actual reply satisfies the expected criteria" },
    "comment": { "type": "string", "description": "Short reason for the score" }
  },
  "required": ["score", "comment"]
}
```

LangSmith writes feedback key **`score`**, not `criteria_match`. That is why the compare table has a column named `score`. Local `evaluate()` uses `key: "criteria_match"` on purpose so the two columns stay distinct.

## Model config (`model.json`)

`langsmith evaluator create-llm` requires `--model-config`: a **serialized LangChain constructor**, not a playground `modelId` blob.

Working constructor (OpenAI-compatible Together):

```json
{
  "lc": 1,
  "type": "constructor",
  "id": ["langchain", "chat_models", "openai", "ChatOpenAI"],
  "name": "ChatOpenAI",
  "kwargs": {
    "model": "zai-org/GLM-5.2",
    "temperature": 0,
    "openai_api_base": "https://api.together.xyz/v1",
    "openai_api_key": {
      "lc": 1,
      "type": "secret",
      "id": ["TOGETHER_AI_API_KEY"]
    }
  }
}
```

The secret id must match a **LangSmith workspace secret** (Settings, Secrets), not only a local env var. This workspace upserts `TOGETHER_AI_API_KEY` via `POST /api/v1/workspaces/current/secrets`. Do not put the key in git or in `model.json`.

Temperature is 0 so grades are more stable.

## Variable mapping

Current mapping:

```json
{
  "input": "input.objective",
  "output": "output.finalReply",
  "reference": "reference.finalReply"
}
```

Hosted LLM rules use **`output.*` and `input.*`**, not `outputs.*` / `inputs.*`.

Code evaluators read `run.outputs.finalReply` in Python/TypeScript. That path is correct for code. It is **wrong** for this hosted judge.

| Mapping tried | What the judge saw |
| --- | --- |
| `outputs.finalReply` | Empty actual reply. Comments said “finalReply is empty” while code evals reported length 600–3000. Gold criteria still arrived via `reference`. Hosted `score` mean 0. |
| `output.finalReply` | Real agent text. Hosted `score` mean 1.0 on replay `workspace-agent-replay-v3-b0d7a67b` (17/17). |

`reference.finalReply` is the dataset example’s gold criteria. Keep that.

Inspect mapping after upload:

```bash
export PATH="$HOME/.local/bin:$PATH"
set -a && . .env.local && set +a
langsmith evaluator get "Workspace Agent Criteria Match"
```

## How it was created

CLI is the Go binary `langsmith` (0.2.55), **not** PyPI `langsmith-cli`.

```bash
export PATH="$HOME/.local/bin:$PATH"
set -a && . .env.local && set +a
export LANGSMITH_ENDPOINT="${LANGSMITH_ENDPOINT:-https://api.smith.langchain.com}"

EVAL_DIR=scripts/langsmith-eval/evaluators/llm-judge
DATASET="Workspace Agent: Final Response"

langsmith evaluator create-llm \
  --name "Workspace Agent Criteria Match" \
  --dataset "$DATASET" \
  --prompt "$EVAL_DIR/prompt.json" \
  --schema "$EVAL_DIR/schema.json" \
  --model-config "$EVAL_DIR/model.json" \
  --variable-mapping "@$EVAL_DIR/variable-mapping.json"
```

`--dataset` attaches an **offline** rule (signature has the dataset example). Do not use `--project study-forge` for this prompt (online rules have no gold `reference`).

If the display name already exists, add `--replace` and confirm. Do not pass `--yes` unless you intend to skip that prompt.

`create-llm` pushes a Prompt Hub commit (StructuredPrompt: messages + schema) and stores the model on the run rule. Hub ref names look like `eval_workspace_agent_final_response_workspace_agent_criteria_match_<suffix>:latest`.

## Attempts that failed (keep this history)

These are real failures in this workspace. Do not retry them as “the” setup.

1. **ChatOpenAI + secret `OPENAI_API_KEY`**  
   `create-llm` returned 400: missing OpenAI credentials. This workspace has no OpenAI key.

2. **Simple playground `modelId` (for example `openai:gpt-4o-mini` or `google_genai:gemini-2.0-flash`)**  
   `create-llm` returned 400: last step of `RunnableSequence` must be a Runnable, not a dict. The CLI expects a LangChain constructor JSON.

3. **`ChatGoogleGenerativeAI` + `gemini-2.0-flash`**  
   Rule created. Experiment `score` had 13 errors: Google 404, model retired (`models/gemini-2.0-flash` no longer available).

4. **`ChatGoogleGenerativeAI` + `gemini-2.5-flash`**  
   Rule replaced. Not used in production for this dataset after the user chose Together GLM-5.2.

5. **Together GLM-5.2 with mapping `outputs.finalReply`**  
   Rule created and Together answered. Hosted `score` was 0 on every row because `{{output}}` was empty. Local `criteria_match` still graded real text (mean about 0.77 on that run).

LangSmith evaluator spend docs talk about OpenAI, Anthropic, or Gemini with pricing. This workspace still hosts a ChatOpenAI constructor aimed at Together. If LangSmith later rejects that class, stop guessing constructors. Copy a working rule from `GET /api/v1/runs/rules` or the UI, or use a documented playground constructor. Do not dump a local `ChatOpenAI(...).dict()`.

## How it runs in an experiment

1. From the repo root: `npx tsx scripts/langsmith-eval/experiments/run-final-response-replay.ts`
2. The target replays each labeled `trace_id` into `{ finalReply }`.
3. Local evaluators write `no_canned_fallback`, `nonempty_reply`, `criteria_match`.
4. Hosted dataset rules fire on the same outputs: two Python code rules plus **Workspace Agent Criteria Match**.
5. Compare URL is printed. Hosted LLM column is **`score`**.

Replay does not call `WorkspaceAgentRunner`. A 1.0 hosted `score` means the **labeled traces** match gold criteria according to GLM-5.2, not that a new agent build was live-tested.

First successful hosted GLM-5.2 run (mapping fixed): experiment `workspace-agent-replay-v3-b0d7a67b`, session `f68f0783-0a66-4c4d-bc88-4f49e1ea37c4`. Hosted `score` avg 1.0 (n=17). Local `criteria_match` avg about 0.88.

## How to tell the columns apart in the UI

| You see | What it is |
| --- | --- |
| `score` = 1, comment about listing dirs / empty index / study plan | Hosted LLM-as-judge |
| `criteria_match` = 0 or 1, or “unparseable JSON” | Local Together call |
| `nonempty_reply` / `workspace agent nonempty reply` | Code, reply length |
| `no_canned_fallback` / `workspace agent no canned fallback` | Code, banned substring |

If hosted comments say the reply is empty but code length is large, the mapping is wrong again. Do not “fix” the agent.

## Recreate or change the model

1. Edit files under `scripts/langsmith-eval/evaluators/llm-judge/` (and local `gradeCriteriaMatch` if the model id changes).
2. Ensure LangSmith has workspace secret `TOGETHER_AI_API_KEY`.
3. Run `create-llm` with `--replace` if the name exists.
4. Run a new replay. Old experiments do not re-score.

To change only the Together model id, update `model.json` `kwargs.model` and the `model` field in `evaluators/local-criteria-match.ts`, then replace the hosted rule.

## What not to do

- Do not invent `model.json` from a local LangChain object dump.
- Do not attach this judge to project `study-forge` (no gold reference on production traces).
- Do not use `--yes` on replace/delete unless you asked to skip confirmation.
- Do not treat hosted `score` 1.0 as a live regression of the planner/tools until a live `WorkspaceAgentRunner` target exists.
- Do not mix `directory-chat` traces into this dataset.
- Do not put API keys in markdown, JSON committed to git, or CLI flags.
