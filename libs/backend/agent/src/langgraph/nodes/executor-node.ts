import type { RunnableConfig } from '@langchain/core/runnables';
import { WORKSPACE_AGENT_STATE_KEYS } from '../workspace-agent-state-keys';
import type { WorkspaceAgentState } from '../workspace-agent-state';
import { WorkspaceAgentStateValue } from '../workspace-agent-state';
import { readWorkspaceAgentConfig } from '../workspace-agent-config';
import {
  formatExecutorPastStep,
  runWorkspaceExecutorStep,
} from '../workspace-agent-executor-llm';
import {
  MAX_PLAN_STEPS,
  MAX_REPLAN_CYCLES,
} from '../workspace-agent-limits';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'executor';

export type ExecutorNodeResult = Partial<WorkspaceAgentState>;

export async function executorNode(
  state: typeof WorkspaceAgentStateValue.State,
  config: RunnableConfig,
): Promise<ExecutorNodeResult> {
  logNodeEnter(NODE_NAME, state);
  try {
    const runtime = readWorkspaceAgentConfig(config);
    const objective = state[WORKSPACE_AGENT_STATE_KEYS.objective];
    const systemPrompt = state[WORKSPACE_AGENT_STATE_KEYS.systemPrompt];
    const history = state[WORKSPACE_AGENT_STATE_KEYS.history] ?? [];
    const planSteps = state[WORKSPACE_AGENT_STATE_KEYS.planSteps] ?? [];
    const pastSteps = state[WORKSPACE_AGENT_STATE_KEYS.pastSteps] ?? [];
    const executedStepCount =
      state[WORKSPACE_AGENT_STATE_KEYS.executedStepCount] ?? 0;
    const replanCycle = state[WORKSPACE_AGENT_STATE_KEYS.replanCycle] ?? 0;

    if (!objective || !systemPrompt) {
      return {
        [WORKSPACE_AGENT_STATE_KEYS.agentOutcome]: 'failed',
        [WORKSPACE_AGENT_STATE_KEYS.failureMessage]:
          'Executor requires objective and systemPrompt',
      };
    }

    if (planSteps.length === 0) {
      return {
        [WORKSPACE_AGENT_STATE_KEYS.plannerIntent]: 'replan',
      };
    }

    if (
      executedStepCount >= MAX_PLAN_STEPS ||
      replanCycle >= MAX_REPLAN_CYCLES
    ) {
      return {
        [WORKSPACE_AGENT_STATE_KEYS.planSteps]: [],
        [WORKSPACE_AGENT_STATE_KEYS.plannerIntent]: 'final',
      };
    }

    const currentStep = planSteps[0];
    const totalSteps = executedStepCount + planSteps.length;

    runtime.onEvent?.({
      type: 'status',
      message: `Step ${executedStepCount + 1} of ${totalSteps}: ${currentStep}`,
    });

    const stepResult = await runWorkspaceExecutorStep({
      userId: runtime.userId,
      systemPrompt,
      objective,
      step: currentStep,
      pastSteps,
      history,
      tools: runtime.tools,
      onEvent: runtime.onEvent,
    });

    const nextPastStep = formatExecutorPastStep({
      step: currentStep,
      text: stepResult.text,
      toolOutcomes: stepResult.toolOutcomes,
    });

    logNodeExitOk(NODE_NAME, state);
    return {
      [WORKSPACE_AGENT_STATE_KEYS.pastSteps]: [nextPastStep],
      [WORKSPACE_AGENT_STATE_KEYS.allToolOutcomes]: stepResult.toolOutcomes,
      [WORKSPACE_AGENT_STATE_KEYS.executedStepCount]: executedStepCount + 1,
      [WORKSPACE_AGENT_STATE_KEYS.planSteps]: planSteps.slice(1),
      [WORKSPACE_AGENT_STATE_KEYS.plannerIntent]: 'replan',
    };
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err);
    const message =
      err instanceof Error ? err.message : 'Workspace executor failed';
    return {
      [WORKSPACE_AGENT_STATE_KEYS.agentOutcome]: 'failed',
      [WORKSPACE_AGENT_STATE_KEYS.failureMessage]: message,
    };
  }
}
