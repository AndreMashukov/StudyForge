# How to run workspace agent LangSmith experiments

This guide is for StudyForge. It covers the **Workspace Agent: Final Response** dataset, hosted code evaluators, the hosted LLM-as-judge, and the local replay experiment runner.

Collect new browser traces with [qa-workspace-agent-browser.md](qa-workspace-agent-browser.md) before you change labels. Domain terms (workspace agent, directory chat, artifact) match [CONTEXT.md](../CONTEXT.md).

## What an experiment is

An experiment is one pass of a **target function** over every example in a dataset. LangSmith stores the target outputs, then scores them.

For this dataset:

- **Inputs:** `objective` (the user prompt)
- **Reference outputs:** `caseId`, `qaResult`, `finalReply` (gold *criteria*, not always the live agent text), optional `mustNotContain`
- **Target output that evaluators read:** `{ "finalReply": "..." }`

Hosted evaluators on the dataset **auto-run** when an experiment writes that `finalReply` field. You do not pass them into `evaluate()` for the hosted columns. Local `evaluate()` still passes extra evaluators in code (including the LLM judge).

## Two ways to run

### 1. Trace replay (what the repo script does today)

`scripts/langsmith-eval/run-final-response-eval.ts` does **not** call `WorkspaceAgentRunner`. For each dataset `objective`, it looks up `trace_id` in the local JSON, reads that LangSmith root run, and copies `outputs.finalReply`.

Use this to:

- Score labeled production or emulator traces
- Check hosted evaluators after an upload
- Iterate on evaluator logic without paying for a full agent turn per example

Do not use this to claim a *new* agent version is better unless you first collected new traces and updated `trace_id` values.

### 2. Live agent (not in the repo yet)

A live experiment would call `WorkspaceAgentRunner.run` (or production `agentMessageStream`) for each `objective` and return `{ finalReply }`. That needs a user, tools, LLM routing, and usually the Firebase emulator. Until that harness exists, live scoring is: run the [browser QA playbook](qa-workspace-agent-browser.md), label traces, then replay.

## Files

| Path | Role |
| --- | --- |
| `scripts/langsmith-eval/datasets/workspace-agent-final-response.json` | Labeled examples (`trace_id`, `inputs`, `outputs`) |
| `scripts/langsmith-eval/upload-final-response-dataset.ts` | Upsert examples by `outputs.caseId` |
| `scripts/langsmith-eval/evaluators/workspace-agent-final-response.ts` | Local TypeScript code evaluators |
| `scripts/langsmith-eval/evaluators/workspace_agent_final_response.py` | Hosted Python code evaluators |
| `scripts/langsmith-eval/evaluators/llm-judge/` | Hosted LLM-as-judge prompt, schema, model, mapping |
| `scripts/langsmith-eval/run-final-response-eval.ts` | Replay `evaluate()` plus local LLM judge |

LangSmith names:

- Tracing project: `LANGSMITH_PROJECT` (expected `study-forge`)
- Dataset: `Workspace Agent: Final Response` (id `cd29f180-cfb3-4162-97cd-59cc6a8fa210`)
- Hosted rules: **Workspace Agent No Canned Fallback**, **Workspace Agent Nonempty Reply**, **Workspace Agent Criteria Match**
- Replay experiment prefix: `workspace-agent-replay-v3` (LangSmith appends a suffix)

## Prerequisites

Run commands from the **workspace root**.

### Environment

Put keys in `.env.local` (do not commit them). `.env.example` only has placeholders.

| Variable | Used for |
| --- | --- |
| `LANGSMITH_API_KEY` | SDK, CLI, tracing, experiments |
| `LANGSMITH_PROJECT` | Trace queries (must match where `workspace-agent` runs land) |
| `TOGETHER_AI_API_KEY` | Local `criteria_match` judge and LangSmith workspace secret for the hosted GLM-5.2 judge |

`functions/.env.local` may also set `LANGSMITH_TRACING=true` for Functions. Dotenv does not override a key already set by `.env.local`.

Do **not** pass API keys as CLI flags.

### LangSmith CLI (evaluator upload)

The evaluator CLI is the Go binary `langsmith`, not the PyPI package `langsmith-cli`.

Expected version: **0.2.55**. Binary path used on this machine: `~/.local/bin/langsmith`.

```bash
export PATH="$HOME/.local/bin:$PATH"
langsmith --version
```

Install a pinned macOS arm64 release (no install-script pipe):

```bash
mkdir -p "$HOME/.local/bin" /tmp/langsmith-cli-install
curl -fsSL -o /tmp/langsmith-cli-install/langsmith_darwin_arm64.tar.gz \
  "https://github.com/langchain-ai/langsmith-cli/releases/download/v0.2.55/langsmith_darwin_arm64.tar.gz"
tar -xzf /tmp/langsmith-cli-install/langsmith_darwin_arm64.tar.gz -C /tmp/langsmith-cli-install
install -m 755 /tmp/langsmith-cli-install/langsmith "$HOME/.local/bin/langsmith"
```

Auth from env:

```bash
set -a
. .env.local
set +a
export LANGSMITH_ENDPOINT="${LANGSMITH_ENDPOINT:-https://api.smith.langchain.com}"
langsmith auth info
```

SDK and CLI must hit the same API URL and workspace. If `langsmith auth info` and a Node `Client()` disagree, stop and fix env before upload.

### Node

Yarn workspace already has `langsmith`. Run scripts with `npx tsx` from the repo root.

## Dataset: create or update

Edit the JSON, then upsert. The upload script **updates** examples that share `outputs.caseId` and **creates** only new case ids. It will not delete remote examples that you removed from the file.

```bash
npx tsx scripts/langsmith-eval/upload-final-response-dataset.ts
```

After QA finds a better gold trace (example: WA-01 pass `01a0a39a-f615-722d-bfd5-2c1032f05575`):

1. Change that row's `trace_id` and `outputs` in the JSON.
2. Run the upsert again.
3. Replay so scores use the new `finalReply`.

`outputs.finalReply` is **criteria for the judge**, not a verbatim dump of the agent. Keep `mustNotContain` on WA-01 so the canned planner fallback still fails the code evaluator.

## Hosted evaluators

These are attached to the dataset, enabled, sampling rate 1.0.

| Display name | Function | Pass when |
| --- | --- | --- |
| Workspace Agent No Canned Fallback | `canned_fallback_evaluator` | `finalReply` does not contain `mustNotContain` (default canned fallback string) |
| Workspace Agent Nonempty Reply | `nonempty_reply_evaluator` | `finalReply` is a non-empty string |

Source: `scripts/langsmith-eval/evaluators/workspace_agent_final_response.py`.

Inspect:

```bash
export PATH="$HOME/.local/bin:$PATH"
set -a && . .env.local && set +a
langsmith evaluator list --format json
langsmith evaluator get "Workspace Agent No Canned Fallback"
langsmith evaluator get "Workspace Agent Nonempty Reply"
langsmith evaluator get "Workspace Agent Criteria Match"
```

Re-upload only if the Python file changed. `--replace` prompts first. Do **not** use `--yes` unless you explicitly want to skip that prompt.

```bash
EVAL_FILE=scripts/langsmith-eval/evaluators/workspace_agent_final_response.py
DATASET="Workspace Agent: Final Response"

langsmith evaluator upload "$EVAL_FILE" \
  --name "Workspace Agent No Canned Fallback" \
  --function canned_fallback_evaluator \
  --dataset "$DATASET" \
  --replace

langsmith evaluator upload "$EVAL_FILE" \
  --name "Workspace Agent Nonempty Reply" \
  --function nonempty_reply_evaluator \
  --dataset "$DATASET" \
  --replace
```

`delete NAME` removes **every** workspace rule with that display name. Run `get NAME` first. Do not delete unless you intend to.

### Hosted LLM-as-judge

Implementation history, mapping pitfall, `model.json`, and how to tell `score` from `criteria_match`: [langsmith-workspace-agent-llm-as-judge.md](langsmith-workspace-agent-llm-as-judge.md).

| Display name | Metric keys | Model | Pass when |
| --- | --- | --- | --- |
| Workspace Agent Criteria Match | schema fields `score` (boolean) and `comment` | Together `zai-org/GLM-5.2` via OpenAI-compatible `ChatOpenAI` (`https://api.together.xyz/v1`) | `score` is true if actual `finalReply` meets gold criteria for the objective |

Rule id `648e559e-c444-4850-8e2c-76a3ab6f56e1`. Hub prompt `eval_workspace_agent_final_response_workspace_agent_criteria_match_939e0f7a:latest`.

Variable mapping must be `input.objective`, `output.finalReply`, `reference.finalReply`. `outputs.finalReply` leaves the judge prompt empty even though the experiment run has `finalReply`.

Source files under `scripts/langsmith-eval/evaluators/llm-judge/`:

- `prompt.json` / `schema.json` / `variable-mapping.json`
- `model.json` (ChatOpenAI constructor, Together base URL, secret `TOGETHER_AI_API_KEY`)

`create-llm` needs a LangChain constructor, not a simple `modelId` blob. ChatOpenAI with `openai_api_base` `https://api.together.xyz/v1` and secret `TOGETHER_AI_API_KEY` is stored in `model.json`. Gemini `gemini-2.0-flash` is retired (404). Do not point this judge at Gemini.

Recreate (do **not** add `--yes`):

```bash
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

If the name already exists, add `--replace` and confirm the prompt. Inspect:

```bash
langsmith evaluator get "Workspace Agent Criteria Match"
```

The hosted judge uses the LangSmith workspace secret `TOGETHER_AI_API_KEY` (same key as `.env.local`) and model `zai-org/GLM-5.2`. Local replay `criteria_match` uses that same Together model.

Online evaluators (`--project study-forge`) are a different signature `(run)` with no dataset example. Do not upload these offline functions to the tracing project.

## Run a replay experiment

From the repo root:

```bash
npx tsx scripts/langsmith-eval/run-final-response-eval.ts
```

What happens:

1. Loads `.env.local` then `functions/.env.local`.
2. Self-checks code evaluators on a known-good and known-bad `finalReply`.
3. Confirms the remote dataset exists.
4. For each example, replays the labeled trace into `{ finalReply }`.
5. Scores locally: `no_canned_fallback`, `nonempty_reply`, `criteria_match` (Together `zai-org/GLM-5.2`).
6. Hosted dataset rules should also score the same experiment outputs.

The script prints an experiment name like `workspace-agent-replay-v3-<suffix>` and a LangSmith compare URL.

`maxConcurrency` is 2 so the judge is not slammed.

### Metrics

| Key | Where it runs | Meaning |
| --- | --- | --- |
| `no_canned_fallback` | Local + hosted | 1 if the canned planner sentence is absent |
| `nonempty_reply` | Local + hosted | 1 if `finalReply` has text |
| `criteria_match` | Local only | 1 if Together `zai-org/GLM-5.2` judges the reply against gold criteria |
| `score` / `comment` | Hosted LLM-as-judge | Same Together GLM-5.2 model, LangSmith-hosted |

If Together is missing, `criteria_match` comments say it was skipped and the score is 0.

## View results

CLI:

```bash
export PATH="$HOME/.local/bin:$PATH"
set -a && . .env.local && set +a
langsmith experiment list --dataset "Workspace Agent: Final Response"
langsmith experiment get workspace-agent-replay-v3-4a1ad903
```

Use the exact experiment name from the runner log. In the UI, open the dataset and the Experiments / compare view.

When reading scores:

- Compare only experiments that used the **same** `trace_id` set, or you are mixing agent versions.
- Hosted columns may duplicate local code metrics (same logic, different column names from the rule display name).
- Hosted `score` / `comment` come from **Workspace Agent Criteria Match**. They can still disagree with local `criteria_match` (same model, different prompt wrapping).
- A `criteria_match` of 0 with "unparseable JSON" was a truncated judge payload; the runner now recovers a leading `"score": 1` or `"score": 0`.

## End-to-end loop (new agent build)

1. Deploy or serve Functions so tracing is on (`agentMessageStream` in production, or emulator with matching `NX_PUBLIC_FIREBASE_PROJECT_ID`).
2. Run browser cases from the QA playbook. Prefer a **new chat** per case.
3. Confirm root runs named `workspace-agent` in project `study-forge`.
4. Update JSON `trace_id` and gold criteria. Upsert the dataset.
5. Run `npx tsx scripts/langsmith-eval/run-final-response-eval.ts`.
6. Compare the new experiment to the previous one in LangSmith.

## Common failures

| Symptom | Likely cause |
| --- | --- |
| `command not found: langsmith` | `~/.local/bin` not on `PATH`, or you ran `langsmith-cli` from pipx |
| `No labeled trace_id for objective` | Dataset `objective` text does not match the JSON map |
| Empty or wrong `finalReply` | Replay read a resume run, or the trace has no `finalReply` |
| Hosted evaluators never fire | Target did not return `finalReply`; or rules attached to a different dataset |
| All `criteria_match` 0 with HTTP 400/403 | Wrong Together model id, or the model is not allowed on this key |
| Canned fallback in production | Planner hit step limits and returned `type: plan`; empty-reply path should now list tool results |
| Traces named `directory-chat` | Wrong UI (directory chat panel, not the floating Agent button) |

## What not to do

- Do not `langsmith self-update` or pipe a remote `install.sh` into a shell (repo skill).
- Do not pass secrets on the CLI.
- Do not use `--yes` on evaluator replace or delete unless you asked for that skip.
- Do not treat replay scores as a live regression test of `WorkspaceAgentRunner` until a live target exists.
- Do not mix `directory-chat` traces into this dataset.
