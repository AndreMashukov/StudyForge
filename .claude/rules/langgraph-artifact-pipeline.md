---
description: LangGraph implementation rules for the diagram-quiz artifact pipeline — state schema, topology, runner contract, definition interface, anti-patterns.
paths:
  - "libs/backend/artifacts/src/artifact-agent-langgraph/**/*.ts"
  - "libs/backend/artifacts/src/diagram-quiz/**/*.ts"
  - "libs/backend/artifacts/src/artifact-pipeline-state-keys.ts"
globs:
  - "libs/backend/artifacts/src/artifact-agent-langgraph/nodes/*.node.ts"
---

# LangGraph diagram-quiz pipeline — implementation rules

Hard constraints on changes under `libs/backend/artifacts/src/artifact-agent-langgraph/**` and the diagram-quiz definition helpers under `libs/backend/artifacts/src/diagram-quiz/**`. These rules come from the merged audit pass (PR #58) that landed the canonical patterns.

## Scope

This ruleset covers `diagramQuiz` only. `flashcards` and the legacy Gemini path stay on ADK. The dispatcher at `libs/backend/generation/src/generation-processors/artifact-agent.ts` is the single switch point. If you change routing, change it there and only there.

## File layout (do not add or rename casually)

```
libs/backend/artifacts/src/artifact-agent-langgraph/
├── diagram-quiz-graph.ts        # StateGraph assembly + addConditionalEdges + route functions
├── diagram-quiz-state.ts        # Annotation.Root state schema + reducers + limits
├── run-diagram-quiz-pipeline.ts # Entry point: compile once, invoke with thread_id+recursionLimit
├── index.ts                     # barrel export
└── nodes/
    ├── load-context.node.ts     # runs definition.loadContext — must be first
    ├── generate.node.ts         # runs definition.generate + writes model label
    ├── gate.node.ts             # deterministic validation via runArtifactGates
    ├── repair.node.ts           # runs definition.repair.repair
    ├── refiner.node.ts          # runs definition.refiner.refine (skip on terminal verdicts)
    ├── critic.node.ts           # runs definition.critic.criticize
    ├── finalize.node.ts         # routes to persistCompleted or markFailed
    └── node-logger.ts           # structured node_enter / node_exit JSON logs
```

## State schema

The schema lives in `diagram-quiz-state.ts` and uses `Annotation.Root` only. No parallel `StateSchema` + `ReducedValue` + zod. Two reducers are defined there and exported; do not invent a third one.

- **Channel keys** must be sourced from `ARTIFACT_PIPELINE_STATE_KEYS` (in `libs/backend/artifacts/src/artifact-pipeline-state-keys.ts`). Hand-typed string literals for keys are not allowed under any node, route function, runner, or helper. The keys use camelCase property access (`.jobInput`, `.gateFailures`) but resolve to snake_case string values (`job_input`, `artifact_gate_failures`).
- **`diagnostics`** and **`gateFailures`** use `replaceWithNext` (last-write-wins; undefined-tolerant). Nodes return the full current object, not deltas.
- **Loop counters** `repair_iteration_count` and `critic_iteration_count` use `incrementCounter`. Default is `0`. Routing checks `< DIAGRAM_QUIZ_LOOP_LIMITS.maxRepairIterations` (4) and `< maxCriticIterations` (2).
- All other channels use LangGraph's default last-write-wins reducer.

`createInitialDiagramQuizState` seeds `definition`, `jobInput`, `diagnostics`, `gateFailures=[]`, and both loop counters at `0`. Do not seed other channels here.

## Topology

```
START
  └─ load-context
       └─ generate
            └─ gate ──(fail && iter<maxRepair)──► repair ──┐
                 ├──(pass || iter≥maxRepair)────► refiner  │
                 └──(outcome==='failed')────────► finalize │
refiner ◄──(overallVerdict!=='pass' && iter<maxCritic)── critic
       └──(overallVerdict==='pass' || iter≥maxCritic)────────► finalize
finalize ──► END
```

- Linear edges via `addEdge(START, …)` for `load-context → generate → gate`; `repair → gate`; `refiner → critic`; `finalize → END`.
- Conditional edges via `addConditionalEdges` for `gate → {repair | refiner | finalize}` and `critic → {refiner | finalize}`. **Never use `Command.goto` inside a node body** — keep routing decisions in named, exported, pure route functions.
- Route functions read state via small typed accessors. Both `routeAfterGate` and `routeAfterCritic` must also check `artifact_outcome === 'failed'` and route to `finalize` so a known-failed run short-circuits without burning loop iterations.
- If `definition.critic` OR `definition.refiner` is missing, **omit the verification-loop edges at construction time.** Do not silently no-op the missing node inside the other — that hides the topology from `graph.getGraph()`.

## Runner contract

`runDiagramQuizLangGraphPipeline(input)` is the only public surface. It:

1. Reads `input.artifactKind` and throws if it is not `'diagramQuiz'`.
2. Resolves the definition from `ArtifactAgentRegistry.get<unknown, unknown>('diagramQuiz')`. The same registered instance is the source of truth both orchestrations use.
3. Compiles the graph (reuses the module-level `diagramQuizGraph` export — never recompile per run).
4. Invokes with `graph.invoke(initialState, { recursionLimit: 25, configurable: { thread_id: input.jobId } })`.
5. Translates the terminal `outcome` into the ADK runner contract: resolve on `'completed'`, throw `ArtifactAgentPipelineFailedError` on `'failed'`, throw a generic error when missing.
6. Catches `GraphRecursionError` from `@langchain/langgraph` and translates it to `ArtifactAgentPipelineFailedError`.
7. Sets `orchestrationMode: 'langgraph-runner'` on every log line so logs are distinguishable from the ADK path.

Callers — the Firebase Functions handler and integration tests — see `runDiagramQuizLangGraphPipeline` and `ArtifactAgentPipelineFailedError`. Nothing else.

## Node signature and body shape

Every node under `nodes/*.node.ts` follows this exact shape:

```ts
const NODE_NAME = '<unique-node-name>';

export type XNodeResult = Partial<DiagramQuizState>;

export async function xNode(
  state: typeof DiagramQuizStateValue.State,
): Promise<XNodeResult> {
  logNodeEnter(NODE_NAME, state);
  try {
    // ...body...
    logNodeExitOk(NODE_NAME, state);
    return result;
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err);
    throw err;
  }
}

export default xNode;
```

Additional constraints:

- Read `definition` off `state[ARTIFACT_PIPELINE_STATE_KEYS.definition]`. Do not close over the definition in a factory; re-read it from state each call. The graph is compiled once and shared across concurrent runs.
- Return **partial** state updates (`{ key: value }`). Never spread `{...state, key: value}`.
- Each callback call must match the `ArtifactAgentDefinition` strategy-object contract:
  - `definition.generate(context, diagnostics)`
  - `definition.critic.criticize(draft, context, diagnostics)`
  - `definition.repair.repair(draft, failures, context, diagnostics)`
  - `definition.refiner.refine(draft, criticResult, context, diagnostics)`
  - `runArtifactGates(definition.gates, draft, context)` for gates (not `definition.runGates` — that does not exist).
  - `definition.persistCompleted(result)` and `definition.markFailed(failure)` from finalize only.
- If a required callback is missing (e.g. `definition.critic` is `undefined`), throw a descriptive error. Do not silently return a default — that hides a wiring bug from the audit surface.
- Do not import from `libs/backend/artifacts/src/artifact-agent/` (ADK bleed-through). The shared types and `ArtifactAgentDefinition` interface are OK; the ADK factory classes (`artifact-agent-pipeline-factory.ts`, `artifact-agent-runner.ts`, etc.) are not.
- Do not import provider SDKs (`@google/genai`, `openai`, etc.). All model calls go through `libs/backend/llm/src/llm/`.
- Do not `console.log` — use `logNodeEnter` / `logNodeExitOk` / `logNodeExitError`. Never log draft contents or any PII.

## Per-node rules

**load-context** — calls `definition.loadContext(jobInput)`, writes the result to `artifact_context`. If the definition is missing `loadContext`, write a minimal context derived from `jobInput` (matches ADK fallback).

**generate** — calls `definition.generate(context, diagnostics)`. After the call:
- Look up the generator's recorded model: `diagnostics.modelUsage.find((u) => u.role === 'generator')?.model`.
- Fall back to the static resolver (`formatGenerationModelLabel(routeResolution.route)`) only when no generator usage is present.
- Write the resolved label to **both** `artifact_generation_model` and `artifact_agent_model` (single source of truth, set once per run).
- Do not re-resolve the route after the call and use that — the audit rejected this because the live LLM call may have used a different model than the static resolver returns.

**gate** — invokes `runArtifactGates(definition.gates, draft, context)`. Writes the full `ArtifactGateFailure[]` to `artifact_gate_failures`. Does not decide routing — the conditional edge from gate decides where to go.

**repair** — when `definition.repair` is undefined, throw. Iterates `repair.repair(draft, failures, context, diagnostics)`. Updates the loop counter to `current + 1`. Concatenation in state is handled by `replaceWithNext` (the node writes the full new list, not a delta).

**refiner** — when `definition.refiner` is undefined, throw. **Skip refinement when `criticResult.overallVerdict === 'fail'` or `'pass'`** — the ADK `RefinerAgent` is a no-op on terminal verdicts, and the LangGraph port must match so the verification loop converges instead of clobbering a draft the critic rejected.

**critic** — when `definition.critic` is undefined, throw. Calls `definition.critic.criticize(draft, context, diagnostics)`. Writes the full `IArtifactCriticResult` to `artifact_critic_result`. Does not decide routing — the conditional edge from critic decides.

**finalize** — derive `shouldFail` from the state the conditional edges produced, not from a default:

```ts
const gateFailures = state[ARTIFACT_PIPELINE_STATE_KEYS.gateFailures] ?? [];
const hasBlockers = gateFailures.some((f) => f.severity === 'blocker');
const criticBlocked = criticResult !== undefined && (
  criticResult.overallVerdict === 'fail' ||
  criticResult.items.some((item) => item.severity === 'blocker')
);
const shouldFail =
  outcome === 'failed' ||
  draft === undefined ||
  diagnostics === undefined ||
  hasBlockers ||
  criticBlocked;
```

A budget-exhausted run with residual blockers must persist as failed, not as completed. Routes to `definition.markFailed(failure)` with a derived message, or `definition.persistCompleted(result)`. Writes `outcome` (`'completed'` | `'failed'`) and `failureMessage` to state.

**Do not write `artifact_generation_model` or `artifact_agent_model` from finalize.** Those keys are owned exclusively by `generate.node.ts` (P6).

## Checkpointer and memory — do not add

The pipeline runs to completion in a single Firebase Functions v2 invocation. The Firestore `session.state` record is the durable artifact — do not graft in `langgraph-checkpoint-sqlite`, `langgraph-checkpoint-postgres`, or `langgraph-checkpoint-memory`.

Do not add `langfuse`, `prometheus-client`, pgvector, or mem0. Cloud Logging + Cloud Trace are wired at the LLM service layer; do not move observability into nodes.

Do not introduce ReAct, `bind_tools`, `interruptBefore`, or `interruptAfter`. The pipeline is fully autonomous and the definitions are pre-shaped LLM calls, not autonomous tool selection.

`recursionLimit: 25` is the safety net and must stay set. Never increase it past `maxRepairIterations + maxCriticIterations + 7` without re-deriving the headroom formula in `run-diagram-quiz-pipeline.ts`.

## Verification protocol (required before any merge)

CI runs esbuild, not `tsc`. A green CI build is not proof. Before reporting a LangGraph change as done:

1. `yarn nx run functions:lint`
2. `yarn nx run functions:build`
3. **Local typecheck** — the spec-implementer engine's `task_critic approve` on the verify node is not proof (it rubber-stamps). Run `tsc -p functions/tsconfig.json --noEmit` from the project root yourself and confirm zero errors.
4. **Smoke test** — deploy only the affected functions (`./node_modules/.bin/firebase deploy --only functions:generateDiagramQuiz,functions:processGenerationJob --project study-forge-202604`), trigger a real `/processGenerationJob` request (or use the `generateDiagramQuiz` callable from the emulator), and confirm:
   - Firestore `session.state.artifact_outcome` is `'completed'` for a happy-path run.
   - For a budget-exhausted fixture: write a failing-gates test definition and confirm `artifact_outcome === 'failed'` and `definition.markFailed` was invoked (not `definition.persistCompleted`).
   - No `recursionLimit exceeded` log lines on a happy-path run (the 25 cap should only fire on runaway loops).
5. Do not deploy unless explicitly requested.

## Cross-reference

- Spec (research-orchestrator audit, post-merge source of truth): `/opt/data/langchain-apps/research-orchestrator/specs/2026-09-06_035954-audit-the-studyforge-diagram-quiz-langgraph-implementation-c/SPEC.md`
- Migration spec (strangler fig scope): `/opt/data/lang-chain/research-orchestrator/specs/2026-09-04_082630-migrate-from-adk-to-langchain-langgraph-scope-strangler-fig/SPEC.md`
- PR #58: https://github.com/AndreMashukov/StudyForge/pull/58
- Hermes skill: `langgraph-artifact-pipeline`
