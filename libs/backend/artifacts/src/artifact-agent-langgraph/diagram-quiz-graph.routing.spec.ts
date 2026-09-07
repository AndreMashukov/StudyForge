import { describe, expect, it } from 'vitest';

import type { ArtifactAgentDefinition } from '../artifact-agent/artifact-agent-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../artifact-pipeline-state-keys';
import {
  routeAfterCritic,
  routeAfterGate,
} from './diagram-quiz-graph';
import {
  DIAGRAM_QUIZ_LOOP_COUNTERS,
  DIAGRAM_QUIZ_LOOP_LIMITS,
  type DiagramQuizState,
} from './diagram-quiz-state';

function gateFailure(
  severity: 'warning' | 'blocker'
): { gateId: string; severity: 'warning' | 'blocker'; message: string } {
  return { gateId: 'test', severity, message: 'test' };
}

function state(partial: Record<string, unknown>): DiagramQuizState {
  return partial as DiagramQuizState;
}

const withVerificationLoop = {
  critic: {},
  refiner: {},
} as ArtifactAgentDefinition<unknown, unknown>;

const withoutVerificationLoop = {} as ArtifactAgentDefinition<
  unknown,
  unknown
>;

describe('routeAfterGate', () => {
  it('routes to finalize when the run is already failed', () => {
    expect(
      routeAfterGate(
        state({
          [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [
            gateFailure('blocker'),
          ],
          [ARTIFACT_PIPELINE_STATE_KEYS.definition]: withVerificationLoop,
          [DIAGRAM_QUIZ_LOOP_COUNTERS.repair]: 0,
        })
      )
    ).toBe('finalize');
  });

  it('leaves the repair loop when only warnings remain', () => {
    expect(
      routeAfterGate(
        state({
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [
            gateFailure('warning'),
          ],
          [ARTIFACT_PIPELINE_STATE_KEYS.definition]: withVerificationLoop,
          [DIAGRAM_QUIZ_LOOP_COUNTERS.repair]: 0,
        })
      )
    ).toBe('refiner');
  });

  it('skips verification when the definition has no critic or refiner', () => {
    expect(
      routeAfterGate(
        state({
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [
            gateFailure('warning'),
          ],
          [ARTIFACT_PIPELINE_STATE_KEYS.definition]: withoutVerificationLoop,
          [DIAGRAM_QUIZ_LOOP_COUNTERS.repair]: 0,
        })
      )
    ).toBe('finalize');
  });

  it('repairs when a blocker remains and the budget is open', () => {
    expect(
      routeAfterGate(
        state({
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [
            gateFailure('blocker'),
          ],
          [ARTIFACT_PIPELINE_STATE_KEYS.definition]: withVerificationLoop,
          [DIAGRAM_QUIZ_LOOP_COUNTERS.repair]: 1,
        })
      )
    ).toBe('repair');
  });

  it('leaves the repair loop when blockers remain but the budget is spent', () => {
    expect(
      routeAfterGate(
        state({
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [
            gateFailure('blocker'),
          ],
          [ARTIFACT_PIPELINE_STATE_KEYS.definition]: withVerificationLoop,
          [DIAGRAM_QUIZ_LOOP_COUNTERS.repair]:
            DIAGRAM_QUIZ_LOOP_LIMITS.maxRepairIterations,
        })
      )
    ).toBe('refiner');
  });
});

describe('routeAfterCritic', () => {
  it('routes to finalize when the run is already failed', () => {
    expect(
      routeAfterCritic(
        state({
          [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
          [ARTIFACT_PIPELINE_STATE_KEYS.criticResult]: {
            overallVerdict: 'needs_work',
          },
          [DIAGRAM_QUIZ_LOOP_COUNTERS.critic]: 0,
        })
      )
    ).toBe('finalize');
  });

  it('finalizes when the critic verdict is pass', () => {
    expect(
      routeAfterCritic(
        state({
          [ARTIFACT_PIPELINE_STATE_KEYS.criticResult]: {
            overallVerdict: 'pass',
          },
          [DIAGRAM_QUIZ_LOOP_COUNTERS.critic]: 0,
        })
      )
    ).toBe('finalize');
  });

  it('continues refinement when the verdict is not pass and budget remains', () => {
    expect(
      routeAfterCritic(
        state({
          [ARTIFACT_PIPELINE_STATE_KEYS.criticResult]: {
            overallVerdict: 'needs_work',
          },
          [DIAGRAM_QUIZ_LOOP_COUNTERS.critic]: 0,
        })
      )
    ).toBe('refiner');
  });

  it('finalizes when the critic budget is spent', () => {
    expect(
      routeAfterCritic(
        state({
          [ARTIFACT_PIPELINE_STATE_KEYS.criticResult]: {
            overallVerdict: 'needs_work',
          },
          [DIAGRAM_QUIZ_LOOP_COUNTERS.critic]:
            DIAGRAM_QUIZ_LOOP_LIMITS.maxCriticIterations,
        })
      )
    ).toBe('finalize');
  });
});
