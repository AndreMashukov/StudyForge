import { END } from '@langchain/langgraph';
import { WORKSPACE_AGENT_STATE_KEYS } from './workspace-agent-state-keys';
import type { WorkspaceAgentState } from './workspace-agent-state';
import {
  MAX_PLAN_STEPS,
  MAX_REPLAN_CYCLES,
} from './workspace-agent-limits';

export const WORKSPACE_AGENT_NODE_NAMES = {
  planner: 'planner',
  executor: 'executor',
} as const;

export function routeAfterPlanner(
  state: WorkspaceAgentState,
): typeof WORKSPACE_AGENT_NODE_NAMES.executor | typeof END | typeof WORKSPACE_AGENT_NODE_NAMES.planner {
  const agentOutcome = state[WORKSPACE_AGENT_STATE_KEYS.agentOutcome];
  if (agentOutcome === 'failed') {
    return END;
  }

  const finalReply = state[WORKSPACE_AGENT_STATE_KEYS.finalReply];
  if (typeof finalReply === 'string' && finalReply.length > 0) {
    return END;
  }

  const plannerIntent = state[WORKSPACE_AGENT_STATE_KEYS.plannerIntent];
  if (plannerIntent === 'complete') {
    return END;
  }

  const planSteps = state[WORKSPACE_AGENT_STATE_KEYS.planSteps] ?? [];
  const executedStepCount =
    state[WORKSPACE_AGENT_STATE_KEYS.executedStepCount] ?? 0;
  const replanCycle = state[WORKSPACE_AGENT_STATE_KEYS.replanCycle] ?? 0;
  const pastSteps = state[WORKSPACE_AGENT_STATE_KEYS.pastSteps] ?? [];

  if (
    planSteps.length > 0 &&
    executedStepCount < MAX_PLAN_STEPS &&
    replanCycle < MAX_REPLAN_CYCLES
  ) {
    return WORKSPACE_AGENT_NODE_NAMES.executor;
  }

  if (pastSteps.length > 0 && planSteps.length === 0) {
    return WORKSPACE_AGENT_NODE_NAMES.planner;
  }

  return END;
}
