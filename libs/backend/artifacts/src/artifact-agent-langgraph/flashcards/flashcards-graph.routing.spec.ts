import { describe, expect, it } from 'vitest';

import type { ArtifactGateFailure } from '../../artifact-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import {
  FLASHCARDS_MAX_REPAIR_ITERATIONS,
  routeAfterGate,
  routeAfterGenerate,
  routeAfterLoadContext,
} from './flashcards-graph';
import type { ArtifactPipelineOutcome, FlashcardsState } from './flashcards-state';

interface IRouteStateFixture {
  [ARTIFACT_PIPELINE_STATE_KEYS.outcome]?: ArtifactPipelineOutcome;
  [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]?: ArtifactGateFailure[];
  repair_loop_count?: number;
}

function gateFailure(severity: ArtifactGateFailure['severity']): ArtifactGateFailure {
  return { gateId: 'test', severity, message: 'test' };
}

function routeState(fixture: IRouteStateFixture): FlashcardsState {
  return fixture as FlashcardsState;
}

describe('routeAfterLoadContext', () => {
  it('routes to finalize when the run is already failed', () => {
    expect(
      routeAfterLoadContext(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
        })
      )
    ).toBe('finalize');
  });

  it('routes to generate when load succeeded', () => {
    expect(routeAfterLoadContext(routeState({}))).toBe('generate');
  });
});

describe('routeAfterGenerate', () => {
  it('routes to finalize when the run is already failed', () => {
    expect(
      routeAfterGenerate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
        })
      )
    ).toBe('finalize');
  });

  it('routes to gate when generation succeeded', () => {
    expect(routeAfterGenerate(routeState({}))).toBe('gate');
  });
});

describe('routeAfterGate', () => {
  it('routes to finalize when the run is already failed', () => {
    expect(
      routeAfterGate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [gateFailure('blocker')],
          repair_loop_count: 0,
        })
      )
    ).toBe('finalize');
  });

  it('routes to finalize when only warnings remain', () => {
    expect(
      routeAfterGate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [gateFailure('warning')],
          repair_loop_count: 0,
        })
      )
    ).toBe('finalize');
  });

  it('routes to repair when blockers remain and budget is available', () => {
    expect(
      routeAfterGate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [gateFailure('blocker')],
          repair_loop_count: 0,
        })
      )
    ).toBe('repair');

    expect(
      routeAfterGate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [gateFailure('blocker')],
          repair_loop_count: 1,
        })
      )
    ).toBe('repair');
  });

  it('routes to finalize when repair budget is exhausted', () => {
    expect(
      routeAfterGate(
        routeState({
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [gateFailure('blocker')],
          repair_loop_count: FLASHCARDS_MAX_REPAIR_ITERATIONS,
        })
      )
    ).toBe('finalize');
  });
});
