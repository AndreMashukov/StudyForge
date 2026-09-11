import {
  callToolChatCompletions,
  LlmGenerationRouteResolver,
  type ILlmToolChatMessage,
} from '@study-forge/backend-llm/llm';
import type { AgentToolDefinition } from '../tools/create-agent-tools';
import type { AgentToolOutcome } from '../runner/agent-chat-fallback';
import {
  buildGroundedCreateReply,
  buildPlannerPrompt,
  parseAgentPlanOutput,
  type AgentPlanOutput,
} from '../runner/agent-plan-execute-helpers';

const PLANNER_PARSE_RETRIES = 1;

export interface ICallWorkspacePlannerModelInput {
  userId: string;
  systemPrompt: string;
  userMessage: string;
  tools: AgentToolDefinition[];
  isReplan: boolean;
  recoverOutcomes?: AgentToolOutcome[];
}

async function runPlannerCompletion(input: {
  userId: string;
  systemPrompt: string;
  userMessage: string;
  tools: AgentToolDefinition[];
  isReplan: boolean;
}): Promise<string> {
  const resolution = await LlmGenerationRouteResolver.resolve('directoryAgent', {
    userId: input.userId,
  });

  if (!resolution.providerApiKey) {
    throw new Error('Workspace planner provider credentials are missing');
  }

  const instruction = `${input.systemPrompt}\n\n${buildPlannerPrompt({
    tools: input.tools,
    isReplan: input.isReplan,
  })}`;

  const messages: ILlmToolChatMessage[] = [
    { role: 'system', content: instruction },
    { role: 'user', content: input.userMessage },
  ];

  const assistantMessage = await callToolChatCompletions({
    route: resolution.route,
    apiKey: resolution.providerApiKey,
    messages,
    tools: [],
    stream: false,
  });

  return assistantMessage.content?.trim() ?? '';
}

export async function callWorkspacePlannerModel(
  input: ICallWorkspacePlannerModelInput,
): Promise<AgentPlanOutput> {
  let userMessage = input.userMessage;
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= PLANNER_PARSE_RETRIES; attempt += 1) {
    const content = await runPlannerCompletion({
      userId: input.userId,
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
