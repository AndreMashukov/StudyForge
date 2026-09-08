---
name: langgraph-artifact-pipeline
description: >-
  Change a LangGraph artifact pipeline (state, nodes, routing, runner).
  Load when editing artifact-agent-langgraph or adding another kind to that graph.
---

# LangGraph artifact pipeline

Use this skill when changing a LangGraph artifact graph. Read `.claude/rules/langgraph-artifact-pipeline.md` first. That file is the constraint list. This skill is the workflow.

## How to work

1. Find the graph, state schema, runner, and nodes under `libs/backend/artifacts/src/artifact-agent-langgraph/`.
2. Keep topology decisions in `addConditionalEdges` plus named route functions. Test those functions with fixtures (blocker vs warning, failed outcome, loop budget).
3. Compile the graph once per process. Invoke it once per job with that job's `thread_id`. Nodes read the definition from seeded state so concurrent jobs can share the compiled graph.
4. Call definition strategy objects (`critic.criticize`, `repair.repair`, `refiner.refine`). Do not invent a second call shape.
5. Persist only in the terminal node (`persistCompleted` / `markFailed`).

## When adding another artifact kind

- Add a kind-specific graph, state schema, runner, and nodes under `artifact-agent-langgraph/<kind>/`.
- Reuse the shared `ARTIFACT_PIPELINE_STATE_KEYS` durable channels and the `ArtifactAgentDefinition` strategy object from `libs/backend/artifacts/src/`.
- Change dispatch in one place (`libs/backend/generation/src/generation-processors/artifact-agent.ts`).
- Do not share node modules across kinds unless the behavior is truly identical.

## Verify before merge

```bash
yarn nx run functions:lint
yarn nx run functions:build
tsc -p functions/tsconfig.json --noEmit
npx vitest run --config vitest.backend.config.ts libs/backend/artifacts/src/artifact-agent-langgraph
```

CI uses esbuild. Local `tsc` is required for LangGraph edits.

## Do not add unless the product needs it

Checkpointer, stream-without-progress, Langfuse-in-nodes, HITL interrupt, ReAct / `bind_tools`.
