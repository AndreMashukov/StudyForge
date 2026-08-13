import {
  callToolChatCompletions,
  LlmGenerationRouteResolver,
  type ILlmToolChatMessage,
} from '@study-forge/backend-llm/llm';
import type { AgentMessageStreamEvent, GenerationKind } from '@shared-types';
import type { AgentToolDefinition } from '../tools/create-agent-tools';
import {
  executeAgentTool,
  toolDefinitionsToOpenAiTools,
} from '../tools/create-agent-tools';
import {
  buildEmptyModelFallback,
  type AgentToolOutcome,
} from './agent-chat-fallback';

const DEFAULT_MAX_TOOL_ROUNDS = 15;
const FALLBACK_DELTA_CHUNK_SIZE = 28;
const FALLBACK_DELTA_DELAY_MS = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed)) {
      return parsed;
    }
  } catch {
    return {};
  }
  return {};
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function chunkText(text: string, chunkSize: number): string[] {
  if (text.length === 0) {
    return [];
  }
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }
  return chunks;
}

export async function emitAgentTextAsDeltas(
  text: string,
  onEvent?: (event: AgentMessageStreamEvent) => void,
): Promise<void> {
  for (const chunk of chunkText(text, FALLBACK_DELTA_CHUNK_SIZE)) {
    onEvent?.({ type: 'delta', text: chunk });
    await sleep(FALLBACK_DELTA_DELAY_MS);
  }
}

export interface AgentChatRunnerInput {
  userId: string;
  systemPrompt: string;
  userMessage: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools: AgentToolDefinition[];
  generationKind?: Extract<GenerationKind, 'directoryChat' | 'agentExecutor'>;
  maxToolRounds?: number;
  emitDeltas?: boolean;
  onEvent?: (event: AgentMessageStreamEvent) => void;
}

export class AgentChatRunner {
  static async run(input: AgentChatRunnerInput): Promise<string> {
    const generationKind = input.generationKind ?? 'directoryChat';
    const maxToolRounds = input.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;
    const emitDeltas = input.emitDeltas ?? true;

    const resolution = await LlmGenerationRouteResolver.resolve(
      generationKind,
      {
        userId: input.userId,
      },
    );

    if (!resolution.providerApiKey) {
      throw new Error('Agent chat provider credentials are missing');
    }

    const openAiTools = toolDefinitionsToOpenAiTools(input.tools);
    const messages: ILlmToolChatMessage[] = [
      { role: 'system', content: input.systemPrompt },
      ...input.history.map((entry) => ({
        role: entry.role,
        content: entry.content,
      })),
      { role: 'user', content: input.userMessage },
    ];
    const toolOutcomes: AgentToolOutcome[] = [];
    let streamedTextLength = 0;

    for (let round = 0; round < maxToolRounds; round += 1) {
      input.onEvent?.({
        type: 'status',
        message: round === 0 ? 'Thinking...' : 'Running tools...',
      });

      let heartbeatTicks = 0;
      const heartbeat = setInterval(() => {
        heartbeatTicks += 1;
        input.onEvent?.({
          type: 'status',
          message:
            round === 0
              ? `Thinking... (${heartbeatTicks * 5}s)`
              : `Running tools... (${heartbeatTicks * 5}s)`,
        });
      }, 5000);

      let assistantMessage: ILlmToolChatMessage;
      try {
        assistantMessage = await callToolChatCompletions({
          route: resolution.route,
          apiKey: resolution.providerApiKey,
          messages,
          tools: openAiTools,
          stream: true,
          onDelta: (text) => {
            if (!emitDeltas) {
              return;
            }
            streamedTextLength += text.length;
            input.onEvent?.({ type: 'delta', text });
          },
        });
      } finally {
        clearInterval(heartbeat);
      }

      messages.push(assistantMessage);

      if (
        !assistantMessage.tool_calls ||
        assistantMessage.tool_calls.length === 0
      ) {
        const text = assistantMessage.content?.trim() ?? '';
        if (text.length > 0) {
          if (emitDeltas && streamedTextLength === 0) {
            await emitAgentTextAsDeltas(text, input.onEvent);
          }
          return text;
        }

        const fallback = buildEmptyModelFallback(toolOutcomes);
        if (emitDeltas) {
          await emitAgentTextAsDeltas(fallback, input.onEvent);
        }
        return fallback;
      }

      for (const toolCall of assistantMessage.tool_calls) {
        input.onEvent?.({
          type: 'status',
          message: `Running ${toolCall.function.name}...`,
        });

        const args = parseToolArguments(toolCall.function.arguments);
        let toolContent: string;
        try {
          const result = await executeAgentTool(
            input.tools,
            toolCall.function.name,
            args,
          );
          toolOutcomes.push({
            name: toolCall.function.name,
            ok: true,
            result,
          });
          toolContent = JSON.stringify(result);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Tool execution failed';
          toolOutcomes.push({
            name: toolCall.function.name,
            ok: false,
            error: message,
          });
          toolContent = JSON.stringify({ error: message });
        }
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: toolContent,
        });
      }
    }

    const limitMessage =
      'I hit the tool step limit while working on your request.';
    if (emitDeltas) {
      await emitAgentTextAsDeltas(limitMessage, input.onEvent);
    }
    return limitMessage;
  }
}
