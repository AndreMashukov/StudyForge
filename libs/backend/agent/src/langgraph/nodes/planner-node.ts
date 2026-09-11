import type { RunnableConfig } from '@langchain/core/runnables';
import {
  UNGROUNDED_CREATE_FALLBACK,
  buildPlannerUserMessage,
  shouldBlockUngroundedCreateResponse,
} from '../../runner/agent-plan-execute-helpers';
import { WORKSPACE_AGENT_STATE_KEYS } from '../workspace-agent-state-keys';
import type { WorkspaceAgentState } from '../workspace-agent-state';
import { WorkspaceAgentStateValue } from '../workspace-agent-state';
import { readWorkspaceAgentConfig } from '../workspace-agent-config';
import {
  callWorkspacePlannerModel,
  callWorkspacePlannerModelStreaming,
} from '../workspace-agent-planner-llm';
import { FORCED_CREATE_DOCUMENT_STEP } from '../workspace-agent-limits';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'planner';

export type PlannerNodeResult = Partial<WorkspaceAgentState>;

function shouldRunFinalPlanner(state: WorkspaceAgentState): boolean {
  const intent = state[WORKSPACE_AGENT_STATE_KEYS.plannerIntent];
  if (intent === 'final') {
    return true;
  }

  const planSteps = state[WORKSPACE_AGENT_STATE_KEYS.planSteps] ?? [];
  const pastSteps = state[WORKSPACE_AGENT_STATE_KEYS.pastSteps] ?? [];
  const finalReply = state[WORKSPACE_AGENT_STATE_KEYS.finalReply];

  return (
    !finalReply &&
    planSteps.length === 0 &&
    pastSteps.length > 0 &&
    intent === 'replan'
  );
}

function buildFallbackFinalReply(state: WorkspaceAgentState): string {
  const pastSteps = state[WORKSPACE_AGENT_STATE_KEYS.pastSteps] ?? [];
  return pastSteps.length > 0
    ? 'I completed the planned steps but could not compose a final reply.'
    : 'I could not complete your request within the planning limits.';
}

export async function plannerNode(
  state: typeof WorkspaceAgentStateValue.State,
  config: RunnableConfig,
): Promise<PlannerNodeResult> {
  logNodeEnter(NODE_NAME, state);
  try {
    const runtime = readWorkspaceAgentConfig(config);
    const objective = state[WORKSPACE_AGENT_STATE_KEYS.objective];
    const systemPrompt = state[WORKSPACE_AGENT_STATE_KEYS.systemPrompt];
    const history = state[WORKSPACE_AGENT_STATE_KEYS.history] ?? [];
    const pastSteps = state[WORKSPACE_AGENT_STATE_KEYS.pastSteps] ?? [];
    const planSteps = state[WORKSPACE_AGENT_STATE_KEYS.planSteps] ?? [];
    const allToolOutcomes =
      state[WORKSPACE_AGENT_STATE_KEYS.allToolOutcomes] ?? [];
    const plannerIntent =
      state[WORKSPACE_AGENT_STATE_KEYS.plannerIntent] ?? 'initial';

    if (!objective || !systemPrompt) {
      return {
        [WORKSPACE_AGENT_STATE_KEYS.agentOutcome]: 'failed',
        [WORKSPACE_AGENT_STATE_KEYS.failureMessage]:
          'Planner requires objective and systemPrompt',
      };
    }

    if (shouldRunFinalPlanner(state)) {
      runtime.onEvent?.({
        type: 'status',
        message: 'Planning final reply...',
      });

      const finalOutput = await callWorkspacePlannerModelStreaming({
        userId: runtime.userId,
        systemPrompt,
        userMessage: buildPlannerUserMessage({
          objective,
          history,
          pastSteps,
        }),
        tools: runtime.tools,
        isReplan: true,
        recoverOutcomes: allToolOutcomes,
        onEvent: runtime.onEvent,
      });

      if (finalOutput.type === 'response') {
        const blocked = shouldBlockUngroundedCreateResponse({
          objective,
          outcomes: allToolOutcomes,
        });
        return {
          [WORKSPACE_AGENT_STATE_KEYS.finalReply]: blocked
            ? UNGROUNDED_CREATE_FALLBACK
            : finalOutput.response,
          [WORKSPACE_AGENT_STATE_KEYS.streamedFinalReply]: true,
          [WORKSPACE_AGENT_STATE_KEYS.plannerIntent]: 'complete',
          [WORKSPACE_AGENT_STATE_KEYS.agentOutcome]: 'succeeded',
        };
      }

      const blocked = shouldBlockUngroundedCreateResponse({
        objective,
        outcomes: allToolOutcomes,
      });
      return {
        [WORKSPACE_AGENT_STATE_KEYS.finalReply]: blocked
          ? UNGROUNDED_CREATE_FALLBACK
          : buildFallbackFinalReply(state),
        [WORKSPACE_AGENT_STATE_KEYS.streamedFinalReply]: blocked,
        [WORKSPACE_AGENT_STATE_KEYS.plannerIntent]: 'complete',
        [WORKSPACE_AGENT_STATE_KEYS.agentOutcome]: 'succeeded',
      };
    }

    const isInitial = plannerIntent === 'initial' && pastSteps.length === 0;
    const isReplan = plannerIntent === 'replan' || pastSteps.length > 0;

    if (isInitial) {
      runtime.onEvent?.({ type: 'status', message: 'Planning...' });
    } else if (isReplan) {
      runtime.onEvent?.({ type: 'status', message: 'Planning next steps...' });
    }

    const plannerOutput = await callWorkspacePlannerModel({
      userId: runtime.userId,
      systemPrompt,
      userMessage: buildPlannerUserMessage({
        objective,
        history,
        pastSteps,
        remainingPlan: isReplan ? planSteps : undefined,
      }),
      tools: runtime.tools,
      isReplan: isReplan && !isInitial,
      recoverOutcomes: allToolOutcomes,
    });

    if (plannerOutput.type === 'response') {
      const blocked = shouldBlockUngroundedCreateResponse({
        objective,
        outcomes: allToolOutcomes,
      });
      if (blocked && pastSteps.length === 0) {
        logNodeExitOk(NODE_NAME, state);
        return {
          [WORKSPACE_AGENT_STATE_KEYS.planSteps]: [FORCED_CREATE_DOCUMENT_STEP],
          [WORKSPACE_AGENT_STATE_KEYS.plannerIntent]: 'replan',
        };
      }
      if (blocked) {
        logNodeExitOk(NODE_NAME, state);
        return {
          [WORKSPACE_AGENT_STATE_KEYS.planSteps]: [FORCED_CREATE_DOCUMENT_STEP],
          [WORKSPACE_AGENT_STATE_KEYS.plannerIntent]: 'replan',
        };
      }

      logNodeExitOk(NODE_NAME, state);
      return {
        [WORKSPACE_AGENT_STATE_KEYS.finalReply]: plannerOutput.response,
        [WORKSPACE_AGENT_STATE_KEYS.plannerIntent]: 'complete',
        [WORKSPACE_AGENT_STATE_KEYS.agentOutcome]: 'succeeded',
      };
    }

    logNodeExitOk(NODE_NAME, state);
    return {
      [WORKSPACE_AGENT_STATE_KEYS.planSteps]: [...plannerOutput.steps],
      [WORKSPACE_AGENT_STATE_KEYS.plannerIntent]: 'replan',
      [WORKSPACE_AGENT_STATE_KEYS.replanCycle]:
        (state[WORKSPACE_AGENT_STATE_KEYS.replanCycle] ?? 0) +
        (isReplan ? 1 : 0),
    };
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err);
    const message =
      err instanceof Error ? err.message : 'Workspace planner failed';
    return {
      [WORKSPACE_AGENT_STATE_KEYS.agentOutcome]: 'failed',
      [WORKSPACE_AGENT_STATE_KEYS.failureMessage]: message,
    };
  }
}
