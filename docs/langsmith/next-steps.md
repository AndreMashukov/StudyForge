# Next steps: LangSmith for workspace agents

Eval scripts live under `scripts/langsmith-eval/` (see that folder’s README for datasets / evaluators / targets / experiments).

## 1. Live experiment target (highest leverage)

Replay (`readRun(trace_id)`) only grades old chats. A live target calls the current agent per dataset `objective` and returns `{ finalReply }`. Then hosted `score` and code evals measure **this build**.

### What to call

Do **not** call `WorkspaceAgentRunner.run` from the eval script first. Production does more than the graph: tools, system prompt, thread store, memory, ungrounded-create guard, `done.response.reply`.

Use `DirectoryAgentService.streamMessage` (same path as `agentMessageStream`):

```ts
async function liveWorkspaceAgent(inputs: {
  objective?: string;
}): Promise<{ finalReply: string }> {
  const objective =
    typeof inputs.objective === 'string' ? inputs.objective : '';
  let finalReply = '';

  for await (const event of DirectoryAgentService.streamMessage(userId, {
    scope: 'workspace',
    message: objective,
    // omit threadId: new thread per example, same as QA "new chat"
  })) {
    if (event.type === 'error') {
      throw new Error(event.message);
    }
    if (event.type === 'done') {
      finalReply = event.response.reply;
    }
  }

  return { finalReply };
}
```

Then:

```ts
await evaluate(liveWorkspaceAgent, {
  data: 'Workspace Agent: Final Response',
  evaluators: [/* same local code + criteria_match as replay */],
  experimentPrefix: 'workspace-agent-live-v1',
  maxConcurrency: 1,
  metadata: { evalKind: 'live-agent' },
});
```

Keep `experiments/run-final-response-replay.ts` as replay. Live harness:

```bash
yarn nx run functions:serve
npx tsx scripts/seed-setup/setup-seed-data.ts
npx tsx scripts/langsmith-eval/experiments/run-final-response-live.ts
```

Smoke: `LANGSMITH_EVAL_MAX_EXAMPLES=2 npx tsx scripts/langsmith-eval/experiments/run-final-response-live.ts`

The script signs in as the seed user (`test@example.com`), POSTs `{ scope: "workspace", message: objective }` to emulator `agentMessageStream`, and returns `{ finalReply }` from the SSE `done` event. `maxConcurrency` is 1. Experiment prefix: `workspace-agent-live-v1`.

### Two ways to host that function

**A. HTTP against the Functions emulator (recommended first)**

1. Emulators + seed: `yarn nx run functions:serve`, then `npx tsx scripts/seed-setup/setup-seed-data.ts`.
2. `--project` must match `NX_PUBLIC_FIREBASE_PROJECT_ID` or callables 404 on CORS.
3. Mint a Firebase ID token for the seed user (`test@example.com` / UID `4ZBsEPIUJ4jrlylcXkg7t3sFdPZv`).
4. POST `http://127.0.0.1:5001/<project>/asia-east1/agentMessageStream` with `{ scope: "workspace", message: objective }`, `Authorization: Bearer <idToken>`, parse SSE until `event: done`, take `data.response.reply`.
5. `functions/.env.local` should have `LANGSMITH_TRACING=true` so live traces land in `study-forge` with `runName` `workspace-agent`.

This hits usage reservation, App Check skip (emulator), and real tool Firestore writes. Same as the browser FAB, without the UI.

**B. In-process `tsx` import**

Import `DirectoryAgentService` from `@study-forge/backend-agent` after pointing Firestore/Storage at the emulator and initializing Admin SDK. You still need LLM routing secrets (`LLM_SETTINGS_ENCRYPTION_KEY`, provider keys). This skips HTTP and usage holds. It is more NX/tsconfig work. Use it later if HTTP overhead bothers you.

Do not point the first live eval at **production** `agentMessageStream`. That mutates a real user and spends production credits.

### Setup the eval user must have

The dataset assumes a workspace like QA: directories (Study Materials), maybe `/QA-Workspace-Eval`, knowledge index for search cases, credits for create/generate cases.

- Same seed data as local QA, or a dedicated eval UID cloned from seed.
- New **thread per example** (no `threadId`).
- `maxConcurrency: 1` so two cases do not create `/QA-Workspace-Eval` at once.

### Mutation problem

Live evals **write** Firestore: `create_directory`, `create_document`, `generate_quiz`, and so on. Replay does not.

Before each full run:

- reset emulator data and re-seed, or
- use a throwaway eval user and delete their tree after the run, or
- skip mutating `caseId`s in v1 (list/search/refuse only) and add create cases once reset is scripted.

Without a reset, the second experiment is not comparable to the first (folders already exist, gold criteria still say “create”).

### What success looks like

- Experiment prefix `workspace-agent-live-v1-…` (not `workspace-agent-replay-v3-…`).
- Compare URL shows hosted `score`, `workspace agent nonempty reply`, `workspace agent no canned fallback`.
- New traces in project `study-forge` named `workspace-agent`.
- You can change a planner prompt, re-run live, and see `score` move. Replay of old `trace_id`s will not move.

### Do not

- Reuse `trace_id` lookup in the live target.
- Mix directory-chat (`scope: "directory"`) into this dataset.
- Run 17 live turns against the QA production user.
- Claim a planner fix worked from replay scores.

## 2. Split “must pass” from “judge quality”

Keep hosted code evals as gates: nonempty reply, no canned fallback. Treat LLM `score` as the quality column. After a live run, look at rows where code passes and `score` is 0. Those are the cases to fix in the planner, tools, or gold criteria.

## 3. Trajectory dataset (next dataset type)

Final-response cannot catch “used `create_document` before approval” or “invented ids after `list_documents`”. Add a trajectory dataset from the same QA cases: expected tool names/order, forbidden tools (`create_document` on plan-only cases, slide/diagram from workspace agent). A code evaluator on `run` children is more reliable here than another LLM.

## 4. Online rules on `study-forge` (careful)

Attach only code online evals at first: empty `finalReply`, canned fallback, maybe max latency. Sample below 1.0. Do not attach the current criteria judge online: it needs `reference.finalReply`, which production traces do not have.

## 5. Annotation queue for the judge

When you disagree with hosted `score`, correct it in LangSmith and turn on few-shot corrections on **Workspace Agent Criteria Match**. That trains the judge on your bar (honest empty index vs invented quotes) without rewriting the prompt every time.

## 6. One agent at a time

Keep workspace agent datasets separate from directory-chat and from artifact graphs (quiz, flashcards, slides). Mixing them makes `score` meaningless. After workspace live evals work, copy the same pattern: traces, then dataset, then one code eval, then one judge.

## 7. Prompt/tool changes as experiments, not vibes

For each planner or tool change: live eval on the same dataset, compare to `workspace-agent-replay-v3-b0d7a67b` (replay baseline) or the latest **live** baseline. Only ship if canned/nonempty stay at 1 and `score` does not drop on WA-01, WA-02, create, and refuse-artifact cases.

## 8. Platform knowledge: four RAG LLM-as-judge metrics (later)

v1 platform-knowledge evals use **code** only. How to run them: [workspace-agent-platform-knowledge.md](workspace-agent-platform-knowledge.md).

- `retrieval_recall`: listed phrases must appear in returned chunk text (not an LLM “are these docs relevant?” grade).
- `policy_facts`: every `mustContain` / no `mustNotContain` on `finalReply` (not “how similar is the answer”).

The LangSmith RAG tutorial four judges are **not** in v1. They can be added later. They need a live target that returns **both** `finalReply` and `retrievedTexts` from the **same** `agentMessageStream` turn (the chunks actually injected into the planner prompt). A second `searchPlatformKnowledge` call is not the same retrieval.

Reuse the existing Together GLM-5.2 hosted judge stack. One evaluator per metric. Mapping must read `input.objective`, `output.finalReply`, `output.retrievedTexts`, and `reference.finalReply` (for correctness). Do not use `outputs.finalReply` (that left the earlier hosted judge empty).

| Tutorial metric | Goal | Needs | v1 stand-in |
| --- | --- | --- | --- |
| Correctness (reply vs reference) | How similar the reply is to a gold answer | Gold `finalReply` (or criteria) on each example | `policy_facts` string checks |
| Relevance (reply vs question) | Whether the reply addresses `objective` | Reply only | none |
| Groundedness (reply vs retrieved chunks) | Whether the reply agrees with those chunks (faithfulness) | Same-turn `retrievedTexts` | none |
| Retrieval relevance (chunks vs question) | Whether those chunks are relevant to `objective` | Same-turn `retrievedTexts` | `retrieval_recall` phrase hits |

Keep `policy_facts` and `retrieval_recall` as cheap gates. Add the four judges as extra columns. A high judge score with a failed `policy_facts` still means a required fact was missed (for example “20”).

**Order:** instrument same-turn `{ finalReply, retrievedTexts }` first, then retrieval relevance and groundedness, then correctness once gold replies exist, then relevance last (weakest signal for this policy file).

Do not attach these judges as online evals on production `workspace-agent` traces until references (and retrieved chunk outputs) exist on those runs.
