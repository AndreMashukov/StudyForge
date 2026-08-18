import { randomUUID } from 'node:crypto';
import {
  BaseAgent,
  InMemoryRunner,
  LlmAgent,
  StreamingMode,
  createEvent,
  createEventActions,
  getFunctionCalls,
  isFinalResponse,
  stringifyContent,
  type Event,
  type InvocationContext,
} from '@google/adk';
import type { AgentMessageStreamEvent } from '@shared-types';
import type { AgentToolDefinition } from '../tools/create-agent-tools';
import { EMPTY_AGENT_REPLY } from '../runner/agent-chat-fallback';
import type { AgentToolOutcome } from '../runner/agent-chat-fallback';
import {
  UNGROUNDED_CREATE_FALLBACK,
  buildGroundedCreateReply,
  buildPlannerPrompt,
  buildPlannerUserMessage,
  buildStepExecutionMessage,
  composeExecutorStepResult,
  parseAgentPlanOutput,
  shouldBlockUngroundedCreateResponse,
  type AgentPlanExecutePastStep,
  type AgentPlanOutput,
} from '../runner/agent-plan-execute-helpers';
import { agentToolsToFunctionTools } from './agent-adk-tools';
import { StudyForgeAdkLlm } from './studyforge-adk-llm';

const WORKSPACE_PLAN_EXECUTE_APP = 'study-forge-workspace-plan-execute';
const MAX_PLAN_STEPS = 8;
const MAX_REPLAN_CYCLES = 8;
const MAX_EXECUTOR_LLM_CALLS = 4;
const PLANNER_PARSE_RETRIES = 1;

const FORCED_CREATE_DOCUMENT_STEP =
  'Call create_document with a generation prompt now. A written summary does not create the document. Do not invent an id.';

const STATE_KEYS = {
  reply: 'reply',
} as const;

export interface AgentAdkPlanExecuteRunnerInput {
  userId: string;
  threadId: string;
  systemPrompt: string;
  objective: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools: AgentToolDefinition[];
  onEvent?: (event: AgentMessageStreamEvent) => void;
}

function eventText(event: Event): string {
  const fromHelper = stringifyContent(event).trim();
  if (fromHelper.length > 0) {
    return fromHelper;
  }
  const parts = event.content?.parts ?? [];
  return parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

function wrapToolsWithOutcomeTracking(
  tools: AgentToolDefinition[],
  collector: AgentToolOutcome[],
): AgentToolDefinition[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    execute: async (args: Record<string, unknown>) => {
      try {
        const result = await tool.execute(args);
        collector.push({ name: tool.name, ok: true, result });
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Tool execution failed';
        collector.push({ name: tool.name, ok: false, error: message });
        return { error: message };
      }
    },
  }));
}

async function runPlannerLlmAgent(input: {
  userId: string;
  sessionId: string;
  systemPrompt: string;
  userMessage: string;
  tools: AgentToolDefinition[];
  isReplan: boolean;
}): Promise<string> {
  const instruction = `${input.systemPrompt}\n\n${buildPlannerPrompt({
    tools: input.tools,
    isReplan: input.isReplan,
  })}`;

  const agent = new LlmAgent({
    name: 'workspacePlanner',
    description: 'Plan-execute planner for the StudyForge workspace agent.',
    model: new StudyForgeAdkLlm({
      userId: input.userId,
      generationKind: 'directoryAgent',
    }),
    instruction,
    tools: [],
    includeContents: 'none',
    disallowTransferToParent: true,
    disallowTransferToPeers: true,
  });

  const runner = new InMemoryRunner({
    agent,
    appName: WORKSPACE_PLAN_EXECUTE_APP,
  });

  await runner.sessionService.createSession({
    appName: WORKSPACE_PLAN_EXECUTE_APP,
    userId: input.userId,
    sessionId: input.sessionId,
  });

  let reply = '';
  for await (const event of runner.runAsync({
    userId: input.userId,
    sessionId: input.sessionId,
    newMessage: {
      role: 'user',
      parts: [{ text: input.userMessage }],
    },
    runConfig: {
      streamingMode: StreamingMode.NONE,
      maxLlmCalls: 2,
    },
  })) {
    if (isFinalResponse(event)) {
      const text = eventText(event);
      if (text.length > 0) {
        reply = text;
      }
    }
  }

  return reply;
}

async function callPlannerModel(input: {
  userId: string;
  systemPrompt: string;
  userMessage: string;
  tools: AgentToolDefinition[];
  isReplan: boolean;
  recoverOutcomes?: AgentToolOutcome[];
}): Promise<AgentPlanOutput> {
  let userMessage = input.userMessage;
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= PLANNER_PARSE_RETRIES; attempt += 1) {
    const content = await runPlannerLlmAgent({
      userId: input.userId,
      sessionId: randomUUID(),
      systemPrompt: input.systemPrompt,
      userMessage,
      tools: input.tools,
      isReplan: input.isReplan,
    });

    const parsed = parseAgentPlanOutput(content);
    if (parsed) {
      return parsed;
    }

    lastError = 'Planner returned invalid JSON';
    userMessage =
      'Your previous output was invalid. Return ONLY valid JSON matching the required schema.';
  }

  const grounded = input.recoverOutcomes
    ? buildGroundedCreateReply(input.recoverOutcomes)
    : null;
  if (grounded) {
    return { type: 'response', response: grounded };
  }

  throw new Error(lastError ?? 'Planner returned invalid JSON');
}

async function runExecutorStep(input: {
  userId: string;
  threadId: string;
  systemPrompt: string;
  objective: string;
  step: string;
  pastSteps: AgentPlanExecutePastStep[];
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools: AgentToolDefinition[];
  onEvent?: (event: AgentMessageStreamEvent) => void;
}): Promise<{ text: string; toolOutcomes: AgentToolOutcome[] }> {
  const toolOutcomes: AgentToolOutcome[] = [];
  const trackedTools = wrapToolsWithOutcomeTracking(input.tools, toolOutcomes);
  const stepMessage = buildStepExecutionMessage({
    objective: input.objective,
    step: input.step,
    pastSteps: input.pastSteps,
  });

  const agent = new LlmAgent({
    name: 'workspaceExecutor',
    description: 'Plan-execute executor for the StudyForge workspace agent.',
    model: new StudyForgeAdkLlm({
      userId: input.userId,
      generationKind: 'agentExecutor',
    }),
    instruction: input.systemPrompt,
    tools: agentToolsToFunctionTools(trackedTools),
    includeContents: 'default',
    disallowTransferToParent: true,
    disallowTransferToPeers: true,
  });

  const runner = new InMemoryRunner({
    agent,
    appName: WORKSPACE_PLAN_EXECUTE_APP,
  });

  const sessionId = randomUUID();
  const session = await runner.sessionService.createSession({
    appName: WORKSPACE_PLAN_EXECUTE_APP,
    userId: input.userId,
    sessionId,
  });

  for (const message of input.history) {
    await runner.sessionService.appendEvent({
      session,
      event: createEvent({
        author: message.role === 'user' ? 'user' : 'workspaceExecutor',
        content: {
          role: message.role === 'user' ? 'user' : 'model',
          parts: [{ text: message.content }],
        },
      }),
    });
  }

  let reply = '';
  for await (const event of runner.runAsync({
    userId: input.userId,
    sessionId,
    newMessage: {
      role: 'user',
      parts: [{ text: stepMessage }],
    },
    runConfig: {
      streamingMode: StreamingMode.NONE,
      maxLlmCalls: MAX_EXECUTOR_LLM_CALLS,
    },
  })) {
    const functionCalls = getFunctionCalls(event);
    if (functionCalls.length > 0) {
      const names = functionCalls
        .map((call) => call.name)
        .filter((name): name is string => Boolean(name));
      if (names.length > 0) {
        input.onEvent?.({
          type: 'status',
          message: `Running ${names.join(', ')}...`,
        });
      }
      continue;
    }

    if (isFinalResponse(event)) {
      const text = eventText(event);
      if (text.length > 0) {
        reply = text;
      }
    }
  }

  if (reply.length === 0) {
    reply = EMPTY_AGENT_REPLY;
  }

  return { text: reply, toolOutcomes };
}

interface PlanExecuteOrchestratorConfig {
  input: AgentAdkPlanExecuteRunnerInput;
}

class PlanExecuteOrchestratorAgent extends BaseAgent {
  private readonly config: PlanExecuteOrchestratorConfig;

  constructor(config: PlanExecuteOrchestratorConfig) {
    super({
      name: 'planExecuteOrchestrator',
      description: 'ADK plan-execute orchestrator for the workspace agent.',
    });
    this.config = config;
  }

  async *runAsyncImpl(_context: InvocationContext) {
    const { input } = this.config;
    const reply = await executePlanExecuteLoop(input);

    yield createEvent({
      author: this.name,
      actions: createEventActions({
        stateDelta: { [STATE_KEYS.reply]: reply },
      }),
    });
  }

  // eslint-disable-next-line require-yield
  async *runLiveImpl() {
    throw new Error('Live mode is not supported for the workspace plan-execute agent');
  }
}

async function executePlanExecuteLoop(
  input: AgentAdkPlanExecuteRunnerInput,
): Promise<string> {
  input.onEvent?.({ type: 'status', message: 'Planning...' });

  const plannerMessage = (
    pastSteps: AgentPlanExecutePastStep[],
    remainingPlan?: string[],
  ): string =>
    buildPlannerUserMessage({
      objective: input.objective,
      history: input.history,
      pastSteps,
      remainingPlan,
    });

  const initialPlan = await callPlannerModel({
    userId: input.userId,
    systemPrompt: input.systemPrompt,
    userMessage: plannerMessage([]),
    tools: input.tools,
    isReplan: false,
  });

  let planSteps: string[] = [];
  if (initialPlan.type === 'response') {
    if (
      shouldBlockUngroundedCreateResponse({
        objective: input.objective,
        outcomes: [],
      })
    ) {
      planSteps = [FORCED_CREATE_DOCUMENT_STEP];
    } else {
      return initialPlan.response;
    }
  } else {
    planSteps = [...initialPlan.steps];
  }

  const pastSteps: AgentPlanExecutePastStep[] = [];
  const allToolOutcomes: AgentToolOutcome[] = [];
  let executedStepCount = 0;

  for (
    let replanCycle = 0;
    replanCycle < MAX_REPLAN_CYCLES;
    replanCycle += 1
  ) {
    while (planSteps.length > 0 && executedStepCount < MAX_PLAN_STEPS) {
      const currentStep = planSteps[0];
      const totalSteps = executedStepCount + planSteps.length;

      input.onEvent?.({
        type: 'status',
        message: `Step ${executedStepCount + 1} of ${totalSteps}: ${currentStep}`,
      });

      const stepResult = await runExecutorStep({
        userId: input.userId,
        threadId: input.threadId,
        systemPrompt: input.systemPrompt,
        objective: input.objective,
        step: currentStep,
        pastSteps,
        history: input.history,
        tools: input.tools,
        onEvent: input.onEvent,
      });

      allToolOutcomes.push(...stepResult.toolOutcomes);
      pastSteps.push({
        step: currentStep,
        result: composeExecutorStepResult(
          stepResult.text,
          stepResult.toolOutcomes,
        ),
      });
      executedStepCount += 1;
      planSteps = planSteps.slice(1);

      input.onEvent?.({ type: 'status', message: 'Planning next steps...' });

      const replanOutput = await callPlannerModel({
        userId: input.userId,
        systemPrompt: input.systemPrompt,
        userMessage: plannerMessage(pastSteps, planSteps),
        tools: input.tools,
        isReplan: true,
        recoverOutcomes: allToolOutcomes,
      });

      if (replanOutput.type === 'response') {
        if (
          shouldBlockUngroundedCreateResponse({
            objective: input.objective,
            outcomes: allToolOutcomes,
          })
        ) {
          planSteps = [FORCED_CREATE_DOCUMENT_STEP];
          break;
        }
        return replanOutput.response;
      }

      planSteps = [...replanOutput.steps];
      break;
    }

    if (planSteps.length === 0) {
      break;
    }
  }

  input.onEvent?.({ type: 'status', message: 'Planning final reply...' });

  const finalOutput = await callPlannerModel({
    userId: input.userId,
    systemPrompt: input.systemPrompt,
    userMessage: plannerMessage(pastSteps),
    tools: input.tools,
    isReplan: true,
    recoverOutcomes: allToolOutcomes,
  });

  if (finalOutput.type === 'response') {
    if (
      shouldBlockUngroundedCreateResponse({
        objective: input.objective,
        outcomes: allToolOutcomes,
      })
    ) {
      return UNGROUNDED_CREATE_FALLBACK;
    }
    return finalOutput.response;
  }

  if (
    shouldBlockUngroundedCreateResponse({
      objective: input.objective,
      outcomes: allToolOutcomes,
    })
  ) {
    return UNGROUNDED_CREATE_FALLBACK;
  }

  return pastSteps.length > 0
    ? 'I completed the planned steps but could not compose a final reply.'
    : 'I could not complete your request within the planning limits.';
}

export class AgentAdkPlanExecuteRunner {
  static async run(input: AgentAdkPlanExecuteRunnerInput): Promise<string> {
    const orchestrator = new PlanExecuteOrchestratorAgent({ input });
    const runner = new InMemoryRunner({
      agent: orchestrator,
      appName: WORKSPACE_PLAN_EXECUTE_APP,
    });

    const sessionId = randomUUID();
    await runner.sessionService.createSession({
      appName: WORKSPACE_PLAN_EXECUTE_APP,
      userId: input.userId,
      sessionId,
    });

    for await (const _event of runner.runAsync({
      userId: input.userId,
      sessionId,
      newMessage: {
        role: 'user',
        parts: [{ text: input.objective }],
      },
      runConfig: {
        streamingMode: StreamingMode.NONE,
        maxLlmCalls: 1,
      },
    })) {
      // Side effects are handled by the orchestrator via onEvent.
    }

    const session = await runner.sessionService.getSession({
      appName: WORKSPACE_PLAN_EXECUTE_APP,
      userId: input.userId,
      sessionId,
    });

    const reply = session?.state[STATE_KEYS.reply];
    return typeof reply === 'string' && reply.length > 0
      ? reply
      : EMPTY_AGENT_REPLY;
  }
}
