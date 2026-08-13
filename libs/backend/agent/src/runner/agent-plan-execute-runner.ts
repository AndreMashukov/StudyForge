import { z } from 'zod';
import {
  callToolChatCompletions,
  JsonSanitizer,
  LlmGenerationRouteResolver,
  type ILlmToolChatMessage,
} from '@study-forge/backend-llm/llm';
import type { AgentMessageStreamEvent } from '@shared-types';
import type { AgentToolDefinition } from '../tools/create-agent-tools';
import { AgentChatRunner, emitAgentTextAsDeltas } from './agent-chat-runner';

const MAX_PLAN_STEPS = 8;
const MAX_REPLAN_CYCLES = 8;
const MAX_EXECUTOR_TOOL_ROUNDS = 4;
const PLANNER_PARSE_RETRIES = 1;

export const agentPlanOutputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('plan'),
    steps: z.array(z.string().trim().min(1)).min(1).max(MAX_PLAN_STEPS),
  }),
  z.object({
    type: z.literal('response'),
    response: z.string().trim().min(1),
  }),
]);

export type AgentPlanOutput = z.output<typeof agentPlanOutputSchema>;

export interface AgentPlanExecutePastStep {
  step: string;
  result: string;
}

export interface AgentPlanExecuteRunnerInput {
  userId: string;
  systemPrompt: string;
  objective: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools: AgentToolDefinition[];
  onEvent?: (event: AgentMessageStreamEvent) => void;
}

function formatToolCatalog(tools: AgentToolDefinition[]): string {
  return tools.map((tool) => `- ${tool.name}: ${tool.description}`).join('\n');
}

function formatPastSteps(pastSteps: AgentPlanExecutePastStep[]): string {
  if (pastSteps.length === 0) {
    return 'None yet.';
  }

  return pastSteps
    .map(
      (entry, index) =>
        `${index + 1}. Step: ${entry.step}\n   Result: ${entry.result}`,
    )
    .join('\n');
}

function buildPlannerPrompt(input: {
  tools: AgentToolDefinition[];
  isReplan: boolean;
}): string {
  const mode = input.isReplan ? 'replanner' : 'planner';

  return [
    `You are the StudyForge workspace agent ${mode}.`,
    'Return ONLY valid JSON with no markdown fences.',
    'Use one of these shapes:',
    '{"type":"plan","steps":["step one","step two"]}',
    '{"type":"response","response":"final user-facing reply"}',
    'Rules:',
    '- Steps must be plain language, not tool JSON.',
    '- Each step should be achievable with the available tools in one focused pass.',
    '- Do not include steps that were already completed.',
    '- Prefer a direct response when no tools are needed.',
    `- At most ${MAX_PLAN_STEPS} steps.`,
    'Available tools:',
    formatToolCatalog(input.tools),
  ].join('\n');
}

function buildPlannerUserMessage(input: {
  objective: string;
  pastSteps: AgentPlanExecutePastStep[];
  remainingPlan?: string[];
}): string {
  const sections = [`Objective:\n${input.objective}`];

  if (input.pastSteps.length > 0) {
    sections.push(`Completed steps:\n${formatPastSteps(input.pastSteps)}`);
  }

  if (input.remainingPlan && input.remainingPlan.length > 0) {
    sections.push(
      `Previous remaining plan (revise as needed):\n${input.remainingPlan
        .map((step, index) => `${index + 1}. ${step}`)
        .join('\n')}`,
    );
  }

  if (input.pastSteps.length > 0) {
    sections.push(
      'Decide whether to return the final user-facing response or an updated remaining plan.',
    );
  } else {
    sections.push(
      'Return either a multi-step plan or a direct response if tools are not needed.',
    );
  }

  return sections.join('\n\n');
}

function buildStepExecutionMessage(input: {
  objective: string;
  step: string;
  pastSteps: AgentPlanExecutePastStep[];
}): string {
  const prior =
    input.pastSteps.length > 0
      ? `\n\nCompleted earlier steps:\n${formatPastSteps(input.pastSteps)}`
      : '';

  return [
    `Overall objective:\n${input.objective}`,
    prior,
    `\nCurrent plan step (complete only this step):\n${input.step}`,
    'Use tools as needed for this step only, then summarize what you accomplished.',
  ].join('');
}

export function parseAgentPlanOutput(raw: string): AgentPlanOutput | null {
  const cleaned = JsonSanitizer.initialCleanup(raw);
  const parsedJson: unknown = (() => {
    try {
      return JSON.parse(cleaned);
    } catch {
      const fallback = JsonSanitizer.tryFallbackParsing(cleaned);
      return fallback;
    }
  })();

  const parsed = agentPlanOutputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

async function callPlannerModel(input: {
  userId: string;
  systemPrompt: string;
  userMessage: string;
  tools: AgentToolDefinition[];
  isReplan: boolean;
}): Promise<AgentPlanOutput> {
  const resolution = await LlmGenerationRouteResolver.resolve(
    'directoryAgent',
    {
      userId: input.userId,
    },
  );

  if (!resolution.providerApiKey) {
    throw new Error('Workspace agent planner credentials are missing');
  }

  const messages: ILlmToolChatMessage[] = [
    {
      role: 'system',
      content: `${input.systemPrompt}\n\n${buildPlannerPrompt({
        tools: input.tools,
        isReplan: input.isReplan,
      })}`,
    },
    { role: 'user', content: input.userMessage },
  ];

  let lastError: string | null = null;

  for (let attempt = 0; attempt <= PLANNER_PARSE_RETRIES; attempt += 1) {
    const assistantMessage = await callToolChatCompletions({
      route: resolution.route,
      apiKey: resolution.providerApiKey,
      messages,
      tools: [],
      stream: false,
    });

    const content = assistantMessage.content?.trim() ?? '';
    const parsed = parseAgentPlanOutput(content);
    if (parsed) {
      return parsed;
    }

    lastError = 'Planner returned invalid JSON';
    messages.push(assistantMessage);
    messages.push({
      role: 'user',
      content:
        'Your previous output was invalid. Return ONLY valid JSON matching the required schema.',
    });
  }

  throw new Error(lastError ?? 'Planner returned invalid JSON');
}

async function streamFinalResponse(
  response: string,
  onEvent?: (event: AgentMessageStreamEvent) => void,
): Promise<string> {
  await emitAgentTextAsDeltas(response, onEvent);
  return response;
}

export class AgentPlanExecuteRunner {
  static async run(input: AgentPlanExecuteRunnerInput): Promise<string> {
    input.onEvent?.({ type: 'status', message: 'Planning...' });

    const initialPlan = await callPlannerModel({
      userId: input.userId,
      systemPrompt: input.systemPrompt,
      userMessage: buildPlannerUserMessage({
        objective: input.objective,
        pastSteps: [],
      }),
      tools: input.tools,
      isReplan: false,
    });

    if (initialPlan.type === 'response') {
      return streamFinalResponse(initialPlan.response, input.onEvent);
    }

    let planSteps = [...initialPlan.steps];
    const pastSteps: AgentPlanExecutePastStep[] = [];
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

        const stepResult = await AgentChatRunner.run({
          userId: input.userId,
          systemPrompt: input.systemPrompt,
          userMessage: buildStepExecutionMessage({
            objective: input.objective,
            step: currentStep,
            pastSteps,
          }),
          history: input.history,
          tools: input.tools,
          generationKind: 'agentExecutor',
          maxToolRounds: MAX_EXECUTOR_TOOL_ROUNDS,
          emitDeltas: false,
          onEvent: input.onEvent,
        });

        pastSteps.push({ step: currentStep, result: stepResult });
        executedStepCount += 1;
        planSteps = planSteps.slice(1);

        input.onEvent?.({ type: 'status', message: 'Planning next steps...' });

        const replanOutput = await callPlannerModel({
          userId: input.userId,
          systemPrompt: input.systemPrompt,
          userMessage: buildPlannerUserMessage({
            objective: input.objective,
            pastSteps,
            remainingPlan: planSteps,
          }),
          tools: input.tools,
          isReplan: true,
        });

        if (replanOutput.type === 'response') {
          return streamFinalResponse(replanOutput.response, input.onEvent);
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
      userMessage: buildPlannerUserMessage({
        objective: input.objective,
        pastSteps,
      }),
      tools: input.tools,
      isReplan: true,
    });

    if (finalOutput.type === 'response') {
      return streamFinalResponse(finalOutput.response, input.onEvent);
    }

    const fallback =
      pastSteps.length > 0
        ? 'I completed the planned steps but could not compose a final reply.'
        : 'I could not complete your request within the planning limits.';
    return streamFinalResponse(fallback, input.onEvent);
  }
}
