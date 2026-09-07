---
description: LangGraph artifact pipeline constraints — state, routing, invoke, nodes.
paths:
  - "libs/backend/artifacts/src/artifact-agent-langgraph/**/*.ts"
  - "libs/backend/artifacts/src/artifact-pipeline-state-keys.ts"
  - "libs/backend/generation/src/generation-processors/artifact-agent.ts"
---

# LangGraph artifact pipelines

Guidance for any LangGraph artifact graph under `artifact-agent-langgraph`. Apply these constraints when you add a node, change routing, or port another artifact kind. Do not treat this file as an inventory of which kinds are live today.

## MUST Follow

1. **MUST use `Annotation.Root` only** for graph state. Do not add a parallel `StateSchema`, `ReducedValue`, or zod schema for the same channels.
2. **MUST source durable channel names** from `ARTIFACT_PIPELINE_STATE_KEYS`. Do not invent string literals for those keys.
3. **MUST return partial state** from nodes (`{ key: value }`). Never spread `{ ...state, key: value }`.
4. **MUST keep routing on edges.** Use `addConditionalEdges` and exported pure route functions. Do not call `Command.goto` inside a node.
5. **MUST exit a gate loop on blocker semantics**, not "empty failure list". Warnings alone must not keep the loop running.
6. **MUST short-circuit to the terminal node** when `artifact_outcome === 'failed'`.
7. **MUST compile the graph once per process and invoke it once per job.** Bind `configurable.thread_id` to that job's id at `invoke` time. Do not recompile per job. Do not switch `invoke` to `stream` unless the change also writes real progress to Firestore.
8. **MUST catch `GraphRecursionError`** at the runner and map it to the existing pipeline failure error.
9. **MUST write generation/agent model labels once**, in the generate node. Later nodes only read them.
10. **MUST keep I/O in load/persist nodes.** Gate and route functions stay deterministic (no LLM, no Firestore).

## Reducers

- If a node returns the **full** list or object, use last-write-wins (`next ?? prev`).
- If a node returns **only new items**, use concat.
- Loop counters: nodes write the next number. The reducer keeps a finite incoming value. Do not name that reducer `increment` if it does not add 1.

## NEVER Do

- NEVER add a checkpointer, HITL interrupt, ReAct, or `bind_tools` to a one-shot Function invoke unless the product needs resume or tool selection.
- NEVER persist the same outcome twice (finalize and again in the runner) unless current code already does that.
- NEVER import provider SDKs in nodes. Model calls go through `@study-forge/backend-llm`.
- NEVER log draft contents or PII. Use the structured node enter/exit logger.
- NEVER treat a green esbuild CI as typecheck. Run `tsc -p functions/tsconfig.json --noEmit` for LangGraph edits.

## Pattern

```ts
export async function exampleNode(
  state: DiagramQuizState
): Promise<Partial<DiagramQuizState>> {
  logNodeEnter('example', state);
  try {
    const value = await work(state);
    logNodeExitOk('example', state);
    return { [ARTIFACT_PIPELINE_STATE_KEYS.draft]: value };
  } catch (err) {
    logNodeExitError('example', state, err);
    return {
      [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
      [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: String(err),
    };
  }
}
```

## Verify

- `yarn nx run functions:lint`
- `yarn nx run functions:build`
- `tsc -p functions/tsconfig.json --noEmit`
- Unit-test route functions as pure functions of state.

Do not deploy unless the user asked.
