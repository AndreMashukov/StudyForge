import { GraphRecursionError } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import type { AgentMessageStreamEvent, AgentQuestion } from '@shared-types';
import type { AgentToolDefinition } from '../tools/create-agent-tools';
import { createAgentToolSession } from '../tools/agent-tool-session';
import { EMPTY_AGENT_REPLY } from '../runner/agent-chat-fallback';
import {
  getFirestoreCheckpointer,
  buildAgentTurnKey,
  CheckpointOverflowUnavailableError,
  CheckpointSerializationTooLargeError,
} from '../checkpointer';
import { WORKSPACE_AGENT_STATE_KEYS } from './workspace-agent-state-keys';
import type { WorkspaceAgentState } from './workspace-agent-state';
import { buildWorkspaceAgentGraph } from './build-workspace-agent-graph';
import { WORKSPACE_AGENT_RECURSION_LIMIT } from './workspace-agent-limits';
import {
  buildLangGraphTraceConfig,
  flushLangSmithTraces,
} from '@study-forge/backend-core/services/langsmith-tracing';

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
  /** Receives the clarifying questions the finished turn asks, if any. */
  onQuestions?: (questions: AgentQuestion[]) => void;
  /** On resume, receives tool outcomes already in the checkpoint before the graph continues. */
  onResumeToolOutcomes?: (outcomes: unknown[]) => void;
  signal?: AbortSignal;
  useMemoryCheckpointer?: boolean;
  /** 1-based task attempt, for trace metadata. */
  attempt?: number;
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

    const toolSession = createAgentToolSession(input.tools);

    try {
      const config = {
        recursionLimit: WORKSPACE_AGENT_RECURSION_LIMIT,
        ...buildLangGraphTraceConfig({
          runName: 'workspace-agent',
          tags: ['langgraph', 'workspace-agent'],
          metadata: {
            userId: input.userId,
            studyForgeThreadId: input.studyForgeThreadId,
            turnId: input.turnId,
            turnKey: langGraphThreadId,
            attempt: String(input.attempt ?? 1),
          },
        }),
        configurable: {
          thread_id: langGraphThreadId,
          userId: input.userId,
          toolSession,
          onEvent: input.onEvent,
          abortSignal: input.signal,
        },
      };

      const freshInput = {
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
        [WORKSPACE_AGENT_STATE_KEYS.questions]: [],
      } satisfies Partial<WorkspaceAgentState>;

      let finalState: WorkspaceAgentState;
      // A graph that already finished in an earlier attempt never streamed its
      // reply to this attempt, so its reply is always emitted below.
      let finishedInEarlierAttempt = false;

      try {
        if (input.resume) {
          const snapshot = await graph.getState(config);
          if (snapshot.createdAt === undefined) {
            // The earlier attempt died before the first checkpoint: start over.
            finalState = await graph.invoke(freshInput, config);
          } else {
            const prior: unknown =
              snapshot.values?.[WORKSPACE_AGENT_STATE_KEYS.allToolOutcomes];
            input.onResumeToolOutcomes?.(Array.isArray(prior) ? prior : []);
            if (snapshot.next.length === 0) {
              finalState = snapshot.values;
              finishedInEarlierAttempt = true;
            } else {
              finalState = await graph.invoke(null, config);
            }
          }
        } else {
          finalState = await graph.invoke(freshInput, config);
        }
      } catch (error) {
        if (error instanceof GraphRecursionError) {
          throw new WorkspaceAgentPipelineFailedError(
            'Workspace agent graph exceeded recursion limit',
          );
        }
        if (
          error instanceof CheckpointOverflowUnavailableError ||
          error instanceof CheckpointSerializationTooLargeError
        ) {
          throw new WorkspaceAgentPipelineFailedError(error.message);
        }
        throw error;
      }

      const outcome = finalState[WORKSPACE_AGENT_STATE_KEYS.agentOutcome];
      if (outcome === 'failed') {
        throw new WorkspaceAgentPipelineFailedError(
          readFailureMessage(finalState),
        );
      }

      const streamedFinal =
        !finishedInEarlierAttempt &&
        finalState[WORKSPACE_AGENT_STATE_KEYS.streamedFinalReply] === true;
      const reply = readFinalReply(finalState);

      if (!streamedFinal && reply.length > 0) {
        input.onEvent?.({ type: 'delta', text: reply });
      }

      const questions = finalState[WORKSPACE_AGENT_STATE_KEYS.questions] ?? [];
      if (questions.length > 0) {
        input.onQuestions?.(questions);
      }

      return reply;
    } finally {
      await flushLangSmithTraces();
    }
  }
}
