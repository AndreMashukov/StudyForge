/**
 * Pure-function tests for `routeAfterGate`.
 *
 * `routeAfterGate` is the conditional-edge function used after the
 * `gate` node in the flashcards LangGraph graph. It is responsible for
 * deciding whether to re-enter the `repair` node (repair loop) or exit
 * the loop and route to `finalize`.
 *
 * Exit conditions tested below (mirroring the migration spec and the
 * `routeAfterGate` implementation in `flashcards-graph.ts`):
 *   1. `artifact_outcome === 'failed'` -> finalize (P4 short-circuit).
 *   2. No blocker gate failures remain (warnings alone exit the loop).
 *   3. `repair_iteration_count >= FLASHCARDS_MAX_REPAIR_ITERATIONS`
 *      -> finalize (budget exhausted).
 *   4. Otherwise -> repair.
 *
 * These tests intentionally cover `routeAfterGate` as a pure function of
 * state. They do NOT import LangGraph, do NOT mock Firestore or the LLM,
 * and do NOT invoke the compiled graph. The fixture `FlashcardsState`
 * objects only fill the channels the route function actually reads.
 *
 * Phase C note: per the spec, the `routeAfterGenerate` companion file
 * (`route-after-generate.test.ts`) tests the post-generate branch; this
 * file is dedicated to the post-gate branch. Together they cover the
 * two conditional edges owned by the flashcards graph.
 */
import { describe, expect, it } from 'vitest';

import type { ArtifactGateFailure } from '../../../artifact-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../../artifact-pipeline-state-keys';
import {
  FLASHCARDS_MAX_REPAIR_ITERATIONS,
  FLASHCARDS_NODE_NAMES,
  routeAfterGate,
} from '../flashcards-graph';
import {
  FLASHCARDS_LOOP_COUNTERS,
  type ArtifactPipelineOutcome,
  type FlashcardsState,
} from '../flashcards-state';

/**
 * Fields the route function actually reads. The production state type
 * requires every channel; tests only fill the routing inputs.
 */
interface IRouteStateFixture {
  [ARTIFACT_PIPELINE_STATE_KEYS.outcome]?: ArtifactPipelineOutcome;
  [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]?: ArtifactGateFailure[];
  [ARTIFACT_PIPELINE_STATE_KEYS.draft]?: unknown;
  [typeof FLASHCARDS_LOOP_COUNTERS.repair]?: number;
}

/**
 * Build a typed `FlashcardsState` from a partial fixture. The cast through
 * `unknown` is intentional: route functions read only a subset of the
 * state channels, and the production state type requires every channel to
 * be present. The cast mirrors the diagram-quiz routing test pattern and
 * keeps the test fixtures minimal.
 */
function routeState(fixture: IRouteStateFixture): FlashcardsState {
  return fixture as unknown as FlashcardsState;
}

/**
 * Small helper to build a typed gate failure for tests. Mirrors the
 * helper used in the diagram-quiz routing spec so the two test files
 * stay consistent.
 */
function gateFailure(
  severity: ArtifactGateFailure['severity']
): ArtifactGateFailure {
  return { gateId: 'test', severity, message: 'test message' };
}

describe('routeAfterGate', () => {
  it('routes to finalize when artifact_outcome is "failed" (P4 short-circuit)', () => {
    // Per P4 of the migration spec: a node that has already marked the
    // run as terminally failed must short-circuit straight to finalize,
    // even if blocker failures are present. Without this, a known-failed
    // run would burn additional repair iterations on a known-bad state.
    expect(
      routeAfterGate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [gateFailure('blocker')],
          [FLASHCARDS_LOOP_COUNTERS.repair]: 0,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.finalize);
  });

  it('routes to finalize when artifact_outcome is "failed" even with budget remaining', () => {
    // The P4 short-circuit must take priority over the repair-loop entry
    // decision; the budget check is not consulted once the run is failed.
    expect(
      routeAfterGate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [gateFailure('blocker')],
          [FLASHCARDS_LOOP_COUNTERS.repair]:
            FLASHCARDS_MAX_REPAIR_ITERATIONS - 1,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.finalize);
  });

  it('routes to finalize when only warning gate failures remain', () => {
    // Per the LangGraph artifact pipeline rules: warnings alone must not
    // keep the loop running. Only blocker failures drive re-entry to the
    // repair node. This is the "exit the gate loop on blocker semantics,
    // not on empty failure list" rule.
    expect(
      routeAfterGate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [gateFailure('warning')],
          [FLASHCARDS_LOOP_COUNTERS.repair]: 0,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.finalize);
  });

  it('routes to finalize when gate failures are absent', () => {
    // An empty (or missing) gate failures array has no blocker entries by
    // definition, so the loop must exit. This covers both the case where
    // the gate node returned an empty array and the case where the
    // channel was never written.
    expect(
      routeAfterGate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [],
          [FLASHCARDS_LOOP_COUNTERS.repair]: 0,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.finalize);
  });

  it('routes to repair when a blocker failure remains and the budget is open', () => {
    // The happy path into the repair loop: at least one blocker remains
    // and the iteration counter is below FLASHCARDS_MAX_REPAIR_ITERATIONS.
    expect(
      routeAfterGate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [gateFailure('blocker')],
          [FLASHCARDS_LOOP_COUNTERS.repair]: 0,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.repair);
  });

  it('routes to repair when multiple blockers remain and budget is open', () => {
    // Multiple blockers do not change the routing decision; any single
    // blocker with budget remaining is enough to re-enter the loop.
    expect(
      routeAfterGate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [
            gateFailure('blocker'),
            gateFailure('blocker'),
          ],
          [FLASHCARDS_LOOP_COUNTERS.repair]:
            FLASHCARDS_MAX_REPAIR_ITERATIONS - 1,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.repair);
  });

  it('routes to finalize when blockers remain but budget is exhausted', () => {
    // Once the repair counter has reached the limit, the loop must exit
    // even though blockers are still present. The route function uses
    // `>=` because the gate node bumps the counter after recording
    // failures; reaching the limit is the exit signal.
    expect(
      routeAfterGate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [gateFailure('blocker')],
          [FLASHCARDS_LOOP_COUNTERS.repair]: FLASHCARDS_MAX_REPAIR_ITERATIONS,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.finalize);
  });

  it('routes to finalize when budget is exceeded past the limit', () => {
    // Counter greater than the limit must also exit the loop. This is a
    // safety check for any node that over-advances the counter.
    expect(
      routeAfterGate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [gateFailure('blocker')],
          [FLASHCARDS_LOOP_COUNTERS.repair]: FLASHCARDS_MAX_REPAIR_ITERATIONS + 5,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.finalize);
  });

  it('does not consult the draft channel (routeAfterGate is post-gate)', () => {
    // The draft channel is owned by the generate / repair nodes. The
    // post-gate routing decision must not depend on the draft's shape or
    // presence; gate failures and the iteration counter are the only
    // signals that matter.
    expect(
      routeAfterGate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.draft]: undefined,
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [gateFailure('blocker')],
          [FLASHCARDS_LOOP_COUNTERS.repair]: 0,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.repair);
  });

  it('treats missing gate failures channel as no blockers', () => {
    // If the gate-failures channel was never written (e.g. an upstream
    // node skipped the gate), the route function must not crash and must
    // exit the loop. The route function's gate-failures reader returns
    // an empty array in that case.
    expect(
      routeAfterGate(
        routeState({
          [FLASHCARDS_LOOP_COUNTERS.repair]: 0,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.finalize);
  });

  it('ignores malformed gate failure entries that do not match the type guard', () => {
    // The route function's `readGateFailures` helper filters through a
    // type guard, so malformed entries (missing `severity`, wrong type,
    // etc.) must be ignored rather than crash the route function. With
    // no surviving blockers, the loop exits.
    const malformed = [
      { gateId: 'malformed' },
      null,
      { severity: 'not-a-severity' },
    ];
    expect(
      routeAfterGate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: malformed as unknown as ArtifactGateFailure[],
          [FLASHCARDS_LOOP_COUNTERS.repair]: 0,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.finalize);
  });

  it('prioritizes the failed outcome over a still-open repair budget', () => {
    // Explicitly: even at repair_iteration_count = 0 (budget fully open)
    // and even with a blocker failure present, a failed outcome must
    // short-circuit the loop. This is the strongest form of the P4 rule.
    expect(
      routeAfterGate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [gateFailure('blocker')],
          [FLASHCARDS_LOOP_COUNTERS.repair]: 0,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.finalize);
  });

  it('does not change behavior for artifact_outcome === "completed"', () => {
    // An explicit "completed" outcome is not a failure; it must NOT
    // short-circuit the gate route. With blockers present and budget
    // open, the run still re-enters the repair loop. (In practice the
    // graph would not reach `routeAfterGate` once the outcome is
    // completed, but the route function must not assume that and must
    // behave deterministically for any outcome value.)
    expect(
      routeAfterGate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'completed',
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [gateFailure('blocker')],
          [FLASHCARDS_LOOP_COUNTERS.repair]: 0,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.repair);
  });

  it('is a pure function: identical inputs produce identical outputs', () => {
    const fixture = routeState({
      [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [gateFailure('blocker')],
      [FLASHCARDS_LOOP_COUNTERS.repair]: 0,
    });
    const first = routeAfterGate(fixture);
    const second = routeAfterGate(fixture);
    expect(first).toBe(second);
    expect(first).toBe(FLASHCARDS_NODE_NAMES.repair);
  });
});
