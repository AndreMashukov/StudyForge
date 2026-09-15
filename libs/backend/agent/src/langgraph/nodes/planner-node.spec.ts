import { describe, expect, it } from 'vitest';
import { WORKSPACE_AGENT_STATE_KEYS } from '../workspace-agent-state-keys';
import type { WorkspaceAgentState } from '../workspace-agent-state';
import { buildFallbackFinalReply, shouldRunFinalPlanner } from './planner-node';

function routeState(
  fixture: Partial<WorkspaceAgentState>,
): WorkspaceAgentState {
  return fixture as WorkspaceAgentState;
}

describe('buildFallbackFinalReply', () => {
  it('uses tool results when the planner never returns type=response', () => {
    const reply = buildFallbackFinalReply(
      routeState({
        [WORKSPACE_AGENT_STATE_KEYS.pastSteps]: [
          { step: 'List directories', result: 'ok' },
        ],
        [WORKSPACE_AGENT_STATE_KEYS.allToolOutcomes]: [
          {
            name: 'list_directories',
            ok: true,
            result: [
              {
                id: 'xcjt24QmCZ0pjyxC2mp6',
                name: 'Study Materials',
                path: '/Study Materials',
              },
            ],
          },
        ],
      }),
    );

    expect(reply).toContain('list_directories');
    expect(reply).toContain('/Study Materials');
    expect(reply).not.toContain(
      'I completed the planned steps but could not compose a final reply.',
    );
  });
});

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
