import { END } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';
import { WORKSPACE_AGENT_STATE_KEYS } from './workspace-agent-state-keys';
import type { WorkspaceAgentState } from './workspace-agent-state';
import {
  routeAfterPlanner,
  WORKSPACE_AGENT_NODE_NAMES,
} from './route-after-planner';

function routeState(
  fixture: Partial<WorkspaceAgentState>,
): WorkspaceAgentState {
  return fixture as WorkspaceAgentState;
}

describe('routeAfterPlanner', () => {
  it('routes to END when the agent failed', () => {
    expect(
      routeAfterPlanner(
        routeState({
          [WORKSPACE_AGENT_STATE_KEYS.agentOutcome]: 'failed',
        }),
      ),
    ).toBe(END);
  });

  it('routes to END when a final reply is present', () => {
    expect(
      routeAfterPlanner(
        routeState({
          [WORKSPACE_AGENT_STATE_KEYS.finalReply]: 'Done.',
        }),
      ),
    ).toBe(END);
  });

  it('routes to executor when plan steps remain within budget', () => {
    expect(
      routeAfterPlanner(
        routeState({
          [WORKSPACE_AGENT_STATE_KEYS.planSteps]: ['List documents'],
          [WORKSPACE_AGENT_STATE_KEYS.executedStepCount]: 0,
          [WORKSPACE_AGENT_STATE_KEYS.replanCycle]: 0,
        }),
      ),
    ).toBe(WORKSPACE_AGENT_NODE_NAMES.executor);
  });

  it('routes back to planner when replan budget is exhausted with remaining steps', () => {
    expect(
      routeAfterPlanner(
        routeState({
          [WORKSPACE_AGENT_STATE_KEYS.planSteps]: ['Create a document'],
          [WORKSPACE_AGENT_STATE_KEYS.pastSteps]: [
            { step: 'List documents', result: 'ok' },
          ],
          [WORKSPACE_AGENT_STATE_KEYS.executedStepCount]: 8,
          [WORKSPACE_AGENT_STATE_KEYS.replanCycle]: 8,
          [WORKSPACE_AGENT_STATE_KEYS.plannerIntent]: 'replan',
        }),
      ),
    ).toBe(WORKSPACE_AGENT_NODE_NAMES.planner);
  });
});
