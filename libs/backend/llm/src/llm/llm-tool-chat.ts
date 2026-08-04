import {
  createStreamingThinkingFilter,
  stripRedactedThinking,
} from './llm-response-text-utils';
import type { ResolvedRoute } from './types';

const REQUEST_TIMEOUT_MS = 120_000;
const GEMINI_OPENAI_COMPAT_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai';

export interface ILlmToolChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

export interface ILlmOpenAiToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function resolveToolChatCompletionsUrl(route: ResolvedRoute): string {
  const baseUrl =
    route.providerType === 'gemini'
      ? GEMINI_OPENAI_COMPAT_BASE_URL
      : route.togetherBaseUrl ??
        route.openRouterBaseUrl ??
        route.miniMaxBaseUrl ??
        'https://api.together.xyz/v1';
  return `${baseUrl.replace(/\/$/, '')}/chat/completions`;
}

function extractAssistantMessage(payload: unknown): ILlmToolChatMessage | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices) || payload.choices.length === 0) {
    return null;
  }
  const choice = payload.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) {
    return null;
  }
  const message = choice.message;
  const content = typeof message.content === 'string' ? message.content : undefined;
  const toolCalls = Array.isArray(message.tool_calls)
    ? message.tool_calls
        .map((call) => {
          if (!isRecord(call) || !isRecord(call.function)) {
            return null;
          }
          const name = typeof call.function.name === 'string' ? call.function.name : '';
          const args = typeof call.function.arguments === 'string' ? call.function.arguments : '{}';
          const id = typeof call.id === 'string' ? call.id : `${name}-${Date.now()}`;
          if (!name) {
            return null;
          }
          return {
            id,
            type: 'function' as const,
            function: { name, arguments: args },
          };
        })
        .filter((call): call is NonNullable<typeof call> => call !== null)
    : undefined;

  return { role: 'assistant', content, tool_calls: toolCalls };
}

function buildRequestHeaders(
  apiKey: string,
  providerType: ResolvedRoute['providerType']
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (providerType === 'openrouter') {
    headers['HTTP-Referer'] = 'https://study-forge.app';
    headers['X-Title'] = 'StudyForge';
  }

  return headers;
}

export async function callToolChatCompletions(input: {
  route: ResolvedRoute;
  apiKey: string;
  messages: ILlmToolChatMessage[];
  tools: ILlmOpenAiToolDefinition[];
  stream?: boolean;
  onDelta?: (text: string) => void;
}): Promise<ILlmToolChatMessage> {
  const stream = input.stream ?? true;
  const url = resolveToolChatCompletionsUrl(input.route);
  const thinkingFilter = createStreamingThinkingFilter();

  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: buildRequestHeaders(input.apiKey, input.route.providerType),
    body: JSON.stringify({
      model: input.route.model,
      messages: input.messages,
      tools: input.tools,
      tool_choice: 'auto',
      stream,
      temperature: 0.4,
      max_tokens: 8192,
      ...(input.route.providerType === 'minimax'
        ? {
            reasoning_split: true,
            thinking: { type: 'disabled' },
          }
        : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '(unreadable)');
    throw new Error(`Tool chat API error ${response.status}: ${errorText}`);
  }

  if (!stream) {
    const payload: unknown = await response.json();
    const message = extractAssistantMessage(payload);
    if (!message) {
      throw new Error('Malformed tool chat response');
    }
    return message;
  }

  if (!response.body) {
    throw new Error('Tool chat stream body missing');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  const toolCallAccumulator = new Map<
    number,
    { id: string; name: string; arguments: string }
  >();

  const reader = response.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) {
          continue;
        }
        const data = trimmed.slice(5).trim();
        if (!data || data === '[DONE]') {
          continue;
        }

        let payload: unknown;
        try {
          payload = JSON.parse(data);
        } catch {
          continue;
        }

        if (!isRecord(payload) || !Array.isArray(payload.choices) || payload.choices.length === 0) {
          continue;
        }

        const choice = payload.choices[0];
        if (!isRecord(choice) || !isRecord(choice.delta)) {
          continue;
        }

        const delta = choice.delta;
        if (typeof delta.content === 'string' && delta.content.length > 0) {
          content += delta.content;
          const cleanedDelta = thinkingFilter.append(delta.content);
          if (cleanedDelta.length > 0) {
            input.onDelta?.(cleanedDelta);
          }
        }

        if (Array.isArray(delta.tool_calls)) {
          for (const call of delta.tool_calls) {
            if (!isRecord(call)) {
              continue;
            }
            const index = typeof call.index === 'number' ? call.index : 0;
            const entry = toolCallAccumulator.get(index) ?? { id: '', name: '', arguments: '' };
            if (typeof call.id === 'string' && call.id.length > 0) {
              entry.id = call.id;
            }
            if (isRecord(call.function)) {
              if (typeof call.function.name === 'string' && call.function.name.length > 0) {
                entry.name = call.function.name;
              }
              if (typeof call.function.arguments === 'string') {
                entry.arguments += call.function.arguments;
              }
            }
            toolCallAccumulator.set(index, entry);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const trailingDelta = thinkingFilter.finalize();
  if (trailingDelta.length > 0) {
    input.onDelta?.(trailingDelta);
  }

  content = stripRedactedThinking(content);

  const toolCalls = [...toolCallAccumulator.entries()]
    .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
    .filter(([, entry]) => entry.name.length > 0)
    .map(([, entry]) => ({
      id: entry.id || `${entry.name}-${Date.now()}`,
      type: 'function' as const,
      function: { name: entry.name, arguments: entry.arguments || '{}' },
    }));

  return {
    role: 'assistant',
    content,
    tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}
