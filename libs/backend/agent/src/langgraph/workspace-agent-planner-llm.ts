import {
  callToolChatCompletions,
  LlmGenerationRouteResolver,
} from '@study-forge/backend-llm/llm';
import type { AgentToolDefinition } from '../tools/create-agent-tools';
import type { AgentToolOutcome } from '../runner/agent-chat-fallback';
import {
  buildGroundedCreateReply,
  buildPlannerPrompt,
  parseAgentPlanOutput,
  type AgentPlanOutput,
} from '../runner/agent-plan-execute-helpers';
import { createPlannerResponseDeltaExtractor } from './planner-response-delta-extractor';
import { buildWorkspacePlannerMessages } from './workspace-agent-planner-messages';

const PLANNER_PARSE_RETRIES = 1;

export interface ICallWorkspacePlannerModelInput {
  userId: string;
  systemPrompt: string;
  userMessage: string;
  tools: AgentToolDefinition[];
  isReplan: boolean;
  recoverOutcomes?: AgentToolOutcome[];
  onUserReplyDelta?: (text: string) => void;
}

export interface IWorkspacePlannerModelResult {
  output: AgentPlanOutput;
  streamedUserReply: string;
}

async function runPlannerCompletion(input: {
  userId: string;
  systemPrompt: string;
  userMessage: string;
  tools: AgentToolDefinition[];
  isReplan: boolean;
  streamUserReply: boolean;
  previousInvalidContent?: string;
  onUserReplyDelta?: (text: string) => void;
}): Promise<{ content: string; streamedUserReply: string }> {
  const resolution = await LlmGenerationRouteResolver.resolve(
    'directoryAgent',
    {
      userId: input.userId,
    },
  );

  if (!resolution.providerApiKey) {
    throw new Error('Workspace planner provider credentials are missing');
  }

  const instruction = `${input.systemPrompt}\n\n${buildPlannerPrompt({
    tools: input.tools,
    isReplan: input.isReplan,
  })}`;

  const messages = buildWorkspacePlannerMessages({
    instruction,
    userMessage: input.userMessage,
    previousInvalidContent: input.previousInvalidContent,
  });

  const extractor = createPlannerResponseDeltaExtractor();
  const streamUserReply =
    input.streamUserReply && Boolean(input.onUserReplyDelta);

  const assistantMessage = await callToolChatCompletions({
    route: resolution.route,
    apiKey: resolution.providerApiKey,
    messages,
    tools: [],
    // MiniMax thinking holds the JSON until the thought ends, so the UI
    // gets one dump after Planning. Turn thinking off for planner turns.
    disableReasoning: true,
    stream: streamUserReply,
    onDelta: streamUserReply
      ? (text) => {
          for (const piece of extractor.push(text)) {
            input.onUserReplyDelta?.(piece);
          }
        }
      : undefined,
  });

  return {
    content: assistantMessage.content?.trim() ?? '',
    streamedUserReply: extractor.emittedText(),
  };
}

export async function callWorkspacePlannerModel(
  input: ICallWorkspacePlannerModelInput,
): Promise<IWorkspacePlannerModelResult> {
  let previousInvalidContent: string | undefined;
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= PLANNER_PARSE_RETRIES; attempt += 1) {
    const streamUserReply = attempt === 0 && Boolean(input.onUserReplyDelta);
    const { content, streamedUserReply } = await runPlannerCompletion({
      userId: input.userId,
      systemPrompt: input.systemPrompt,
      userMessage: input.userMessage,
      tools: input.tools,
      isReplan: input.isReplan,
      streamUserReply,
      previousInvalidContent,
      onUserReplyDelta: streamUserReply ? input.onUserReplyDelta : undefined,
    });

    const parsed = parseAgentPlanOutput(content);
    if (parsed) {
      return { output: parsed, streamedUserReply };
    }

    if (streamedUserReply.trim().length > 0) {
      return {
        output: { type: 'response', response: streamedUserReply.trim() },
        streamedUserReply,
      };
    }

    lastError = 'Planner returned invalid JSON';
    previousInvalidContent = content;
  }

  const grounded = input.recoverOutcomes
    ? buildGroundedCreateReply(input.recoverOutcomes)
    : null;
  if (grounded) {
    return {
      output: { type: 'response', response: grounded },
      streamedUserReply: '',
    };
  }

  throw new Error(lastError ?? 'Planner returned invalid JSON');
}
