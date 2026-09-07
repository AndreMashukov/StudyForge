/** LangGraph node: evaluate the flashcards draft and persist gate diagnostics. */
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../../../artifact-pipeline-state-keys';
import { runArtifactGates } from '../../../../artifact-definition';
import { FlashcardsStateValue } from '../flashcards-state';
import type { FlashcardsState } from '../flashcards-state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'gate';

export type GateNodeResult = Partial<FlashcardsState>;

/**
 * LangGraph node: evaluate the flashcards draft and persist gate diagnostics.
 *
 * The gate node does NOT write `artifact_generation_model` or
 * `artifact_agent_model`. Those keys are set exclusively by `generate.node.ts`
 * and must not be overwritten on subsequent super-steps. See the P6 audit fix.
 *
 * P8 audit contract (verified):
 *   - This node has NO LLM calls. It does NOT instantiate a chat model,
 *     does NOT call any `langchain` `.invoke()` / `.stream()` / `.batch()`
 *     against an LLM, and does NOT touch any model factory. Running an LLM
 *     inside the deterministic gate step would be both wasteful and a
 *     source of non-determinism in the repair loop.
 *   - This node has NO Firestore / database / network I/O. It does NOT
 *     import `firebase-admin`, `@google-cloud/firestore`, or any other
 *     external client. The audit harness can grep this file for those
 *     imports to confirm; only `load-context.node.ts` matches.
 *   - Gate evaluation is performed exclusively via the pure, deterministic
 *     `runArtifactGates(definition.gates, draft, context)` helper - the
 *     same helpers the ADK `GateAgent` uses. The result is a structured
 *     array of `ArtifactGateFailure` entries (`{ gateId, severity,
 *     message, ... }`) with `severity` limited to `'warning' | 'blocker'`.
 *     No side effects.
 *   - Because the gate has no side effects, it is safe to invoke
 *     `maxRepairIterations + 1` times per pipeline run (once on first entry
 *     from `generate`, then once per repair iteration). The conditional
 *     edge `routeAfterGate` enforces the upper bound and short-circuits
 *     to `finalize` once `repair_iteration_count >= maxRepairIterations`.
 *   - Because the gate has no LLM cost, the
 *     `Firebase Functions v2 540-second` ceiling is unaffected by the gate
 *     loop. Only `repair` contributes model latency, and each invocation
 *     has its own per-iteration budget enforced by the matching
 *     conditional edge.
 *
 * Flashcards-specific notes:
 *   - Flashcards is repair-only, so the gate node does NOT have a
 *     post-repair verification loop to dispatch into. The conditional
 *     edge after `gate` routes either back to `repair` or forward to
 *     `finalize`. There is no `refiner` / `critic` target.
 *   - The gate node re-reads the draft on every entry. Because the gate
 *     is a pure function of `(definition, draft, context)`, it can be
 *     safely re-entered; the only state it writes is the gate-failure
 *     list, which the conditional edge then reads to decide whether to
 *     re-enter the repair loop.
 *
 * Emits `node_enter` and `node_exit` structured log lines with `jobId`.
 * `iteration` is `null` because the gate node sits at the head of the
 * repair loop; the conditional edge after `gate` reads
 * `repair_iteration_count` instead of attributing iteration here.
 */
export async function gateNode(
  state: typeof FlashcardsStateValue.State
): Promise<GateNodeResult> {
  logNodeEnter(NODE_NAME, state);
  try {
    // P4 (per the migration spec): if a previous node has already marked
    // the run as terminally failed (e.g. `generate` could not produce a
    // draft), short-circuit the gate to an empty failure list. The
    // conditional edge after `gate` then routes straight to `finalize`.
    // Without this guard the gate would throw on the missing draft,
    // swallowing the failure message that `generate` already wrote and
    // leaving the Firestore record without a recorded failure.
    if (state[ARTIFACT_PIPELINE_STATE_KEYS.outcome] === 'failed') {
      const result = {
        [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [],
      } as GateNodeResult;
      logNodeExitOk(NODE_NAME, state);
      return result;
    }

    const draft = state[ARTIFACT_PIPELINE_STATE_KEYS.draft];
    if (draft === undefined) {
      throw new Error('Gate node requires artifact_draft in state');
    }

    const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition];
    if (!definition) {
      throw new Error('Gate node requires artifact_definition in state');
    }

    const context = state[ARTIFACT_PIPELINE_STATE_KEYS.context];
    if (context === undefined || context === null) {
      throw new Error('Gate node requires artifact_context in state');
    }
    const gateResult = await runArtifactGates(
      definition.gates,
      draft,
      context
    );
    const gateFailures = gateResult.failures;
    const result = {
      [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: gateFailures,
    } as GateNodeResult;
    logNodeExitOk(NODE_NAME, state);
    return result;
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err);
    throw err;
  }
}

export default gateNode;