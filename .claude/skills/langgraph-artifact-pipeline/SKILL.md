---
name: langgraph-artifact-pipeline
description: "Work on the StudyForge diagram-quiz LangGraph pipeline. Load before modifying files under `libs/backend/artifacts/src/artifact-agent-langgraph/**` or `libs/backend/artifacts/src/diagram-quiz/**`. Use when fixing a state-schema reducer, adding a node, debugging recursionLimit trips, or wiring a new generator."
---

# langgraph-artifact-pipeline

StudyForge migrated `diagramQuiz` from ADK to LangGraph in PR #56; the canonical-pattern audit landed in PR #58 (now merged into `main`). This skill is the on-demand companion to the project rule at `/opt/data/StudyForge/.claude/rules/langgraph-artifact-pipeline.md`. Load it before any change under those paths.

## Strangler-fig scope

- `diagramQuiz` → LangGraph (this skill).
- `flashcards` → still ADK (`libs/backend/artifacts/src/artifact-agent/`).
- Legacy Gemini path (standard quiz, sequence quiz, slide deck) → still Gemini.

Do not move any other artifact kind to LangGraph without an updated spec. The dispatcher at `libs/backend/generation/src/generation-processors/artifact-agent.ts` is the only place where routing changes.

## Topology (memorize)

```
START
  └─ load-context → generate → gate
                       gate ──(fail && iter<4)──► repair ──┐
                           ├──(pass || iter≥4)────────────► refiner ──┐
                           └──(outcome==='failed')──────────► finalize │
  refiner ◄──(verdict≠'pass' && iter<2)── critic                  │
           └──(verdict=='pass' || iter≥2)────────────► finalize ──┘
                       finalize → END
```

- `addConditionalEdges` for `gate` and `critic`. **No `Command.goto` inside nodes.**
- Route functions are exported, pure, and named: `routeAfterGate`, `routeAfterCritic`.
- If `definition.critic` OR `definition.refiner` is missing, **omit the verification-loop edges at construction time** — do not silently no-op one node inside the other.

## State-schema contract

- Schema = `Annotation.Root`, defined once in `diagram-quiz-state.ts`. No parallel `StateSchema`/`ReducedValue`.
- Every channel key sourced from `ARTIFACT_PIPELINE_STATE_KEYS` (`libs/backend/artifacts/src/artifact-pipeline-state-keys.ts`). Hand-typed string keys are not allowed under nodes, route functions, helpers, or the runner.
- Reducers (do not invent a third):
  - `diagnostics`, `gateFailures` → `replaceWithNext` (last-write-wins; undefined-tolerant). Nodes return the full current value.
  - `repair_iteration_count`, `critic_iteration_count` → `incrementCounter` (default `0`).
  - everything else → LangGraph default.
- Loop bounds: `maxRepairIterations: 4`, `maxCriticIterations: 2`, both exported from `diagram-quiz-state.ts`.

## Definition interface

`ArtifactAgentDefinition<TDraft, TPayload>` in `libs/backend/artifacts/src/artifact-agent/artifact-agent-definition.ts`. The diagram-quiz implementation lives in `libs/backend/artifacts/src/diagram-quiz/diagram-quiz-definition.ts`. Both LangGraph and ADK runners resolve the same instance from `ArtifactAgentRegistry`.

Strategy-object calls (NOT bare functions):

| node | call |
|---|---|
| generate | `definition.generate(context, diagnostics)` |
| gate | `runArtifactGates(definition.gates, draft, context)` |
| repair | `definition.repair.repair(draft, failures, context, diagnostics)` |
| refiner | `definition.refiner.refine(draft, criticResult, context, diagnostics)` |
| critic | `definition.critic.criticize(draft, context, diagnostics)` |
| finalize | `definition.persistCompleted(result)` or `definition.markFailed(failure)` |

If a callback is missing, the node throws a descriptive error. No silent no-ops.

## Runner contract

`runDiagramQuizLangGraphPipeline(input)` in `run-diagram-quiz-pipeline.ts`:

- Throws if `input.artifactKind !== 'diagramQuiz'`.
- Resolves definition via `ArtifactAgentRegistry.get<unknown, unknown>('diagramQuiz')`.
- Compiles once and reuses the module-level `diagramQuizGraph` export.
- Calls `graph.invoke(initialState, { recursionLimit: 25, configurable: { thread_id: input.jobId } })`.
- Reads `artifact_outcome` off final state. `'completed'` → resolve; `'failed'` → throw `ArtifactAgentPipelineFailedError`; missing → throw a generic error.
- Catches `GraphRecursionError` → translates to `ArtifactAgentPipelineFailedError`. Logs with `orchestrationMode: 'langgraph-runner'`.

## Per-node rules (one-line summary)

- `load-context`: read definition from state, call `loadContext(jobInput)`, write `artifact_context`.
- `generate`: call `definition.generate(context, diagnostics)`. **Model label = `diagnostics.modelUsage.find(role='generator')?.model`, fall back to `formatGenerationModelLabel(routeResolution.route)` only when absent.** Write to BOTH `artifact_generation_model` and `artifact_agent_model` once per run.
- `gate`: call `runArtifactGates(definition.gates, draft, context)`. Write full `ArtifactGateFailure[]`. No routing decisions here.
- `repair`: increment `repair_iteration_count` before invoking `definition.repair.repair`.
- `refiner`: **skip when `criticResult.overallVerdict === 'fail' | 'pass'`** (matches ADK `RefinerAgent` contract). Otherwise call `definition.refiner.refine`.
- `critic`: call `definition.critic.criticize`. Write full `IArtifactCriticResult`. No routing decisions here.
- `finalize`: derive `shouldFail` from `outcome`, missing draft, missing diagnostics, gate blockers, or critic `overallVerdict === 'fail'` / any blocker item. Route to `markFailed` or `persistCompleted`. Write `artifact_outcome` and `artifact_failure_message`. **Do not write model labels from finalize** — that's `generate.node.ts`'s job (P6).

## Cross-package import rules

- From any node: import shared types from `@shared-types`; import `ArtifactAgentDefinition` and the strategy-object interfaces from `libs/backend/artifacts/src/artifact-agent/`; import state from `./diagram-quiz-state`.
- Never import from `artifact-agent-pipeline-factory.ts`, `artifact-agent-runner.ts`, or any other ADK factory module. Those are ADK paths.
- Never import provider SDKs (`@google/genai`, `openai`, etc.). All model calls go through `libs/backend/llm/src/llm/`.
- Never import `@langchain/core` directly — use the `@langchain/langgraph` re-exported surface only.

## Verification protocol (run before merge — no exceptions)

1. `yarn nx run functions:lint`
2. `yarn nx run functions:build`
3. **Local `tsc`** (CI runs esbuild, not tsc): `tsc -p functions/tsconfig.json --noEmit` from project root. Zero errors.
4. **Smoke test against deployed functions** — `./node_modules/.bin/firebase deploy --only functions:generateDiagramQuiz,functions:processGenerationJob --project study-forge-202604`, then trigger a real request. Confirm in Firestore `session.state`:
   - Happy path: `artifact_outcome === 'completed'`.
   - Failing-gates fixture: `artifact_outcome === 'failed'`, `definition.markFailed` was called (not `persistCompleted`).
   - No `recursionLimit exceeded` logs on the happy path.

The engine's `task_critic approve` is not proof — it rubber-stamps the spec-implementer output. Don't ship a LangGraph change without running steps 1-3 yourself and pushing the smoke-test evidence in the PR description.

## Anti-patterns (rejected by PR #58 audit)

- PostgresSaver / `langgraph-checkpoint-postgres` — locked to Firebase Functions v2 + Firestore.
- mem0 + pgvector — no long-term memory requirement.
- Langfuse / Prometheus / Grafana — out of stack inside Firebase Functions.
- ReAct / `bind_tools` — definitions are pre-shaped LLM calls.
- `interruptBefore` / human-in-the-loop — pipeline is fully autonomous.
- `Command.goto` inside a node body — routing belongs in `addConditionalEdges`.
- Bare-function definition calls (`definition.critic(draft)`) — use strategy-object form.
- Type casts on the `diagramQuizGraph` export (`as unknown as ...`) — the inferred return type already exposes `CompiledStateGraph`.
- New channel keys not present in `ARTIFACT_PIPELINE_STATE_KEYS`.
- Re-resolving the LLM route after `definition.generate` to compute the model label — read it off `diagnostics.modelUsage` instead.

## Source pointers

- Project rule (path-scoped): `/opt/data/StudyForge/.claude/rules/langgraph-artifact-pipeline.md`
- Implementation: `libs/backend/artifacts/src/artifact-agent-langgraph/`
- Definition: `libs/backend/artifacts/src/diagram-quiz/diagram-quiz-definition.ts`
- State keys: `libs/backend/artifacts/src/artifact-pipeline-state-keys.ts`
- Migration spec: `/opt/data/lang-chain/research-orchestrator/specs/2026-09-04_082630-migrate-from-adk-to-langchain-langgraph-scope-strangler-fig/SPEC.md`
- Audit spec (post-merge source of truth): `/opt/data/langchain-apps/research-orchestrator/specs/2026-09-06_035954-audit-the-studyforge-diagram-quiz-langgraph-implementation-c/SPEC.md`
- PR #58 with the audit: https://github.com/AndreMashukov/StudyForge/pull/58
