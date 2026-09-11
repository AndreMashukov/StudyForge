import { describe, expect, it } from 'vitest';
import { WORKSPACE_AGENT_STATE_KEYS } from '../workspace-agent-state-keys';
import type { WorkspaceAgentState } from '../workspace-agent-state';
import { shouldRunFinalPlanner } from './planner-node';

function routeState(
  fixture: Partial<WorkspaceAgentState>,
): WorkspaceAgentState {
  return fixture as WorkspaceAgentState;
}

describe('shouldRunFinalPlanner', () => {
  it('treats exhausted replan budget as final even when steps remain', () => {
    expect(
      shouldRunFinalPlanner(
        routeState({
          [WORKSPACE_AGENT_STATE_KEYS.pastSteps]: [
            { step: 'List documents', result: 'ok' },
          ],
          [WORKSPACE_AGENT_STATE_KEYS.planSteps]: ['Create a document'],
          [WORKSPACE_AGENT_STATE_KEYS.executedStepCount]: 8,
          [WORKSPACE_AGENT_STATE_KEYS.replanCycle]: 8,
          [WORKSPACE_AGENT_STATE_KEYS.plannerIntent]: 'replan',
        }),
      ),
    ).toBe(true);
  });
});
