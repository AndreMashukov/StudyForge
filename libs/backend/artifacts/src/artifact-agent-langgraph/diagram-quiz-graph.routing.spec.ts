import { describe, expect, it } from 'vitest';

import type { ArtifactGateFailure } from '../artifact-agent/artifact-agent-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../artifact-pipeline-state-keys';
import {
  routeAfterCritic,
  routeAfterGate,
} from './diagram-quiz-graph';
import {
  DIAGRAM_QUIZ_LOOP_COUNTERS,
  DIAGRAM_QUIZ_LOOP_LIMITS,
  type ArtifactPipelineOutcome,
  type DiagramQuizState,
} from './diagram-quiz-state';

/**
 * Fields the route functions actually read. The production state type
 * requires every channel; tests only fill the routing inputs.
 */
interface IRouteDefinitionFixture {
  critic?: object;
  refiner?: object;
}

interface IRouteCriticResultFixture {
  overallVerdict?: string;
}

interface IRouteStateFixture {
  [ARTIFACT_PIPELINE_STATE_KEYS.outcome]?: ArtifactPipelineOutcome;
  [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]?: ArtifactGateFailure[];
  [ARTIFACT_PIPELINE_STATE_KEYS.definition]?: IRouteDefinitionFixture;
  [ARTIFACT_PIPELINE_STATE_KEYS.criticResult]?: IRouteCriticResultFixture;
  [typeof DIAGRAM_QUIZ_LOOP_COUNTERS.repair]?: number;
  [typeof DIAGRAM_QUIZ_LOOP_COUNTERS.critic]?: number;
}

function gateFailure(severity: ArtifactGateFailure['severity']): ArtifactGateFailure {
  return { gateId: 'test', severity, message: 'test' };
}

function routeState(fixture: IRouteStateFixture): DiagramQuizState {
  return fixture as DiagramQuizState;
}

const withVerificationLoop: IRouteDefinitionFixture = {
  critic: {},
  refiner: {},
};

const withoutVerificationLoop: IRouteDefinitionFixture = {};

describe('routeAfterGate', () => {
  it('routes to finalize when the run is already failed', () => {
    expect(
      routeAfterGate(
        routeState({
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
        routeState({
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
        routeState({
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
        routeState({
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
        routeState({
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
        routeState({
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
        routeState({
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
        routeState({
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
        routeState({
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
