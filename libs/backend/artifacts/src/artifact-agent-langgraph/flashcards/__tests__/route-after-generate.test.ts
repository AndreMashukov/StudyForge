/**
 * Pure-function tests for `routeAfterGenerate`.
 *
 * `routeAfterGenerate` is the conditional-edge function used after the
 * `generate` node to close the P4 failure-routing gap called out in the
 * migration spec. Specifically: if a `generate` (or any earlier) node has
 * already written `artifact_outcome = 'failed'`, routing must skip the
 * `gate` node (which would otherwise run against a missing/invalid draft)
 * and route straight to `finalize`.
 *
 * These tests intentionally cover `routeAfterGenerate` as a pure function
 * of state. They do NOT import LangGraph, do NOT mock Firestore or the
 * LLM, and do NOT invoke the compiled graph. The fixture `FlashcardsState`
 * objects only fill the channels the route function actually reads.
 */
import { describe, expect, it } from 'vitest';

import type { ArtifactGateFailure } from '../../../artifact-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../../artifact-pipeline-state-keys';
import {
  FLASHCARDS_NODE_NAMES,
  routeAfterGenerate,
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

describe('routeAfterGenerate', () => {
  it('routes to gate on the happy path (no failure outcome)', () => {
    expect(
      routeAfterGenerate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.draft]: { cards: [] },
          [FLASHCARDS_LOOP_COUNTERS.repair]: 0,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.gate);
  });

  it('routes to finalize when artifact_outcome is "failed" (P4 short-circuit)', () => {
    expect(
      routeAfterGenerate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
          [ARTIFACT_PIPELINE_STATE_KEYS.draft]: undefined,
          [FLASHCARDS_LOOP_COUNTERS.repair]: 0,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.finalize);
  });

  it('routes to finalize when artifact_outcome is "failed" even with a draft present', () => {
    // The P4 short-circuit must win regardless of whether a draft was
    // written; otherwise the gate node could still execute and waste
    // super-steps on an already-marked-failed run.
    expect(
      routeAfterGenerate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
          [ARTIFACT_PIPELINE_STATE_KEYS.draft]: { cards: [] },
          [FLASHCARDS_LOOP_COUNTERS.repair]: 1,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.finalize);
  });

  it('routes to gate when artifact_outcome is "completed"', () => {
    // An explicit "completed" outcome should not be treated as a failure.
    // Only "failed" triggers the P4 short-circuit. "completed" is a
    // terminal signal that downstream nodes respect.
    expect(
      routeAfterGenerate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'completed',
          [ARTIFACT_PIPELINE_STATE_KEYS.draft]: { cards: [] },
          [FLASHCARDS_LOOP_COUNTERS.repair]: 0,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.gate);
  });

  it('does not consult gate failures (routeAfterGenerate is pre-gate)', () => {
    // Gate failures belong to the gate node's output, not generate's.
    // routeAfterGenerate must NOT route to finalize just because gate
    // failures happen to exist on state from a prior run; that is the
    // routeAfterGate function's responsibility.
    expect(
      routeAfterGenerate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [
            { gateId: 'test', severity: 'blocker', message: 'blocked' },
          ],
          [FLASHCARDS_LOOP_COUNTERS.repair]: 0,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.gate);
  });

  it('does not consult the repair loop counter (routeAfterGenerate is pre-loop)', () => {
    // The repair counter is owned by routeAfterGate. routeAfterGenerate
    // must ignore it; even with the counter at the limit, the post-generate
    // routing decision should still send the run to gate.
    expect(
      routeAfterGenerate(
        routeState({
          [FLASHCARDS_LOOP_COUNTERS.repair]: 99,
        })
      )
    ).toBe(FLASHCARDS_NODE_NAMES.gate);
  });

  it('is a pure function: identical inputs produce identical outputs', () => {
    const fixture = routeState({
      [ARTIFACT_PIPELINE_STATE_KEYS.draft]: { cards: [] },
      [FLASHCARDS_LOOP_COUNTERS.repair]: 0,
    });
    const first = routeAfterGenerate(fixture);
    const second = routeAfterGenerate(fixture);
    expect(first).toBe(second);
    expect(first).toBe(FLASHCARDS_NODE_NAMES.gate);
  });
});