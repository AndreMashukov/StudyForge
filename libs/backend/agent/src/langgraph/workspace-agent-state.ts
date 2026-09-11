import { Annotation } from '@langchain/langgraph';
import {
  WORKSPACE_AGENT_STATE_KEYS,
  type WorkspaceAgentOutcome,
  type WorkspaceAgentPlannerIntent,
} from './workspace-agent-state-keys';
import type { AgentPlanExecutePastStep } from '../runner/agent-plan-execute-helpers';
import type { AgentToolOutcome } from '../runner/agent-chat-fallback';

export const WorkspaceAgentStateAnnotation = Annotation.Root({
  [WORKSPACE_AGENT_STATE_KEYS.studyForgeThreadId]: Annotation<string>(),
  [WORKSPACE_AGENT_STATE_KEYS.objective]: Annotation<string>(),
  [WORKSPACE_AGENT_STATE_KEYS.systemPrompt]: Annotation<string>(),
  [WORKSPACE_AGENT_STATE_KEYS.history]: Annotation<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),
  [WORKSPACE_AGENT_STATE_KEYS.planSteps]: Annotation<string[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  [WORKSPACE_AGENT_STATE_KEYS.pastSteps]: Annotation<
    AgentPlanExecutePastStep[]
  >({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),
  [WORKSPACE_AGENT_STATE_KEYS.allToolOutcomes]: Annotation<AgentToolOutcome[]>(
    {
      reducer: (current, update) => current.concat(update),
      default: () => [],
    },
  ),
  [WORKSPACE_AGENT_STATE_KEYS.executedStepCount]: Annotation<number>({
    reducer: (_current, update) => update,
    default: () => 0,
  }),
  [WORKSPACE_AGENT_STATE_KEYS.replanCycle]: Annotation<number>({
    reducer: (_current, update) => update,
    default: () => 0,
  }),
  [WORKSPACE_AGENT_STATE_KEYS.plannerIntent]: Annotation<
    WorkspaceAgentPlannerIntent | undefined
  >(),
  [WORKSPACE_AGENT_STATE_KEYS.finalReply]: Annotation<string | undefined>(),
  [WORKSPACE_AGENT_STATE_KEYS.streamedFinalReply]: Annotation<
    boolean | undefined
  >(),
  [WORKSPACE_AGENT_STATE_KEYS.agentOutcome]: Annotation<
    WorkspaceAgentOutcome | undefined
  >(),
  [WORKSPACE_AGENT_STATE_KEYS.failureMessage]: Annotation<
    string | undefined
  >(),
});

export type WorkspaceAgentState = typeof WorkspaceAgentStateAnnotation.State;

export const WorkspaceAgentStateValue = WorkspaceAgentStateAnnotation;
