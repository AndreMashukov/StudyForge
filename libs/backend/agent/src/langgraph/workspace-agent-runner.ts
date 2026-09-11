import { GraphRecursionError } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import type { AgentMessageStreamEvent } from '@shared-types';
import type { AgentToolDefinition } from '../tools/create-agent-tools';
import { EMPTY_AGENT_REPLY } from '../runner/agent-chat-fallback';
import {
  getFirestoreCheckpointer,
  buildAgentTurnKey,
  CheckpointOverflowUnavailableError,
} from '../checkpointer';
import { WORKSPACE_AGENT_STATE_KEYS } from './workspace-agent-state-keys';
import type { WorkspaceAgentState } from './workspace-agent-state';
import { buildWorkspaceAgentGraph } from './build-workspace-agent-graph';
import { WORKSPACE_AGENT_RECURSION_LIMIT } from './workspace-agent-limits';

export class WorkspaceAgentPipelineFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceAgentPipelineFailedError';
  }
}

let productionGraph: ReturnType<typeof buildWorkspaceAgentGraph> | null = null;
const testGraph = buildWorkspaceAgentGraph(new MemorySaver());

function getProductionGraph() {
  if (!productionGraph) {
    productionGraph = buildWorkspaceAgentGraph(getFirestoreCheckpointer());
  }
  return productionGraph;
}

export interface IWorkspaceAgentRunnerInput {
  userId: string;
  studyForgeThreadId: string;
  turnId: string;
  resume?: boolean;
  systemPrompt: string;
  objective: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools: AgentToolDefinition[];
  onEvent?: (event: AgentMessageStreamEvent) => void;
  useMemoryCheckpointer?: boolean;
}

function readFinalReply(finalState: WorkspaceAgentState): string {
  const reply = finalState[WORKSPACE_AGENT_STATE_KEYS.finalReply];
  if (typeof reply === 'string' && reply.length > 0) {
    return reply;
  }
  return EMPTY_AGENT_REPLY;
}

function readFailureMessage(finalState: WorkspaceAgentState): string {
  const message = finalState[WORKSPACE_AGENT_STATE_KEYS.failureMessage];
  return typeof message === 'string' && message.trim().length > 0
    ? message
    : 'Workspace agent graph failed';
}

export class WorkspaceAgentRunner {
  static async run(input: IWorkspaceAgentRunnerInput): Promise<string> {
    const graph = input.useMemoryCheckpointer
      ? testGraph
      : getProductionGraph();

    const langGraphThreadId = buildAgentTurnKey(
      input.studyForgeThreadId,
      input.turnId,
    );

    const config = {
      recursionLimit: WORKSPACE_AGENT_RECURSION_LIMIT,
      configurable: {
        thread_id: langGraphThreadId,
        userId: input.userId,
        tools: input.tools,
        onEvent: input.onEvent,
      },
    };

    let finalState: WorkspaceAgentState;

    try {
      if (input.resume) {
        finalState = await graph.invoke(null, config);
      } else {
        finalState = await graph.invoke(
          {
            [WORKSPACE_AGENT_STATE_KEYS.studyForgeThreadId]:
              input.studyForgeThreadId,
            [WORKSPACE_AGENT_STATE_KEYS.objective]: input.objective,
            [WORKSPACE_AGENT_STATE_KEYS.systemPrompt]: input.systemPrompt,
            [WORKSPACE_AGENT_STATE_KEYS.history]: input.history,
            [WORKSPACE_AGENT_STATE_KEYS.plannerIntent]: 'initial',
            [WORKSPACE_AGENT_STATE_KEYS.agentOutcome]: 'pending',
            [WORKSPACE_AGENT_STATE_KEYS.planSteps]: [],
            [WORKSPACE_AGENT_STATE_KEYS.pastSteps]: [],
            [WORKSPACE_AGENT_STATE_KEYS.allToolOutcomes]: [],
            [WORKSPACE_AGENT_STATE_KEYS.executedStepCount]: 0,
            [WORKSPACE_AGENT_STATE_KEYS.replanCycle]: 0,
          },
          config,
        );
      }
    } catch (error) {
      if (error instanceof GraphRecursionError) {
        throw new WorkspaceAgentPipelineFailedError(
          'Workspace agent graph exceeded recursion limit',
        );
      }
      if (error instanceof CheckpointOverflowUnavailableError) {
        throw new WorkspaceAgentPipelineFailedError(error.message);
      }
      throw error;
    }

    const outcome = finalState[WORKSPACE_AGENT_STATE_KEYS.agentOutcome];
    if (outcome === 'failed') {
      throw new WorkspaceAgentPipelineFailedError(readFailureMessage(finalState));
    }

    const streamedFinal =
      finalState[WORKSPACE_AGENT_STATE_KEYS.streamedFinalReply] === true;
    const reply = readFinalReply(finalState);

    if (!streamedFinal && reply.length > 0) {
      input.onEvent?.({ type: 'delta', text: reply });
    }

    return reply;
  }
}
