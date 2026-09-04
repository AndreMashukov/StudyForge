import {
  createStreamingThinkingFilter,
  stripRedactedThinking,
} from './llm-response-text-utils';
import type { ILlmGenerationRuntimeSettings } from '@shared-types';
import {
  normalizeGeminiUsageMetadata,
  normalizeOpenAiCompatibleUsage,
  recordLlmProviderResult,
} from '@study-forge/backend-core/services/provider-cost';
import type { ResolvedRoute } from './types';
import { readLlmGenerationRuntimeSettings } from './llm-generation-settings-repository';
import { togetherReasoningBodyExtras } from './together-reasoning-body';

const GEMINI_OPENAI_COMPAT_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai';
const TOGETHER_DEFAULT_BASE_URL = 'https://api.together.ai/v1';

/**
 * Opaque provider-specific fields that must round-trip on tool calls.
 * Gemini OpenAI-compat uses `extra_content.google.thought_signature`.
 */
export type ILlmToolChatProviderMetadata = Record<string, unknown>;

export interface ILlmToolChatToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
  providerMetadata?: ILlmToolChatProviderMetadata;
}

export interface ILlmToolChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: ILlmToolChatToolCall[];
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

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value };
}

/**
 * Capture wire-format extras (e.g. Gemini `extra_content`) into opaque metadata.
 */
export function extractProviderMetadataFromWireToolCall(
  call: Record<string, unknown>,
): ILlmToolChatProviderMetadata | undefined {
  const metadata: ILlmToolChatProviderMetadata = {};

  if (isRecord(call.extra_content)) {
    metadata.extra_content = cloneRecord(call.extra_content);
  }

  if (isRecord(call.provider_metadata)) {
    metadata.provider_metadata = cloneRecord(call.provider_metadata);
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Convert an internal tool call back to OpenAI-compat wire format, restoring
 * any provider extras that must be echoed on subsequent turns.
 */
export function toWireToolCall(
  toolCall: ILlmToolChatToolCall,
): Record<string, unknown> {
  const wire: Record<string, unknown> = {
    id: toolCall.id,
    type: 'function',
    function: {
      name: toolCall.function.name,
      arguments: toolCall.function.arguments,
    },
  };

  const metadata = toolCall.providerMetadata;
  if (!metadata) {
    return wire;
  }

  if (isRecord(metadata.extra_content)) {
    wire.extra_content = cloneRecord(metadata.extra_content);
  } else if (
    typeof metadata.thoughtSignature === 'string' ||
    typeof metadata.thought_signature === 'string'
  ) {
    const signature =
      typeof metadata.thoughtSignature === 'string'
        ? metadata.thoughtSignature
        : String(metadata.thought_signature);
    wire.extra_content = {
      google: {
        thought_signature: signature,
      },
    };
  }

  if (isRecord(metadata.provider_metadata)) {
    wire.provider_metadata = cloneRecord(metadata.provider_metadata);
  }

  return wire;
}

export function parseWireToolCall(call: unknown): ILlmToolChatToolCall | null {
  if (!isRecord(call) || !isRecord(call.function)) {
    return null;
  }

  const name = typeof call.function.name === 'string' ? call.function.name : '';
  const args =
    typeof call.function.arguments === 'string'
      ? call.function.arguments
      : '{}';
  const id = typeof call.id === 'string' ? call.id : '';
  if (!name) {
    return null;
  }

  const providerMetadata = extractProviderMetadataFromWireToolCall(call);
  return {
    id: id || `${name}-${Date.now()}`,
    type: 'function',
    function: { name, arguments: args },
    ...(providerMetadata ? { providerMetadata } : {}),
  };
}

/**
 * Normalize canonical messages into the OpenAI-compat wire shape for a provider.
 * Preserves opaque tool-call metadata and omits empty assistant content when
 * tool_calls are present (required by Gemini OpenAI-compat).
 */
export function normalizeMessagesForWire(
  messages: ILlmToolChatMessage[],
): Array<Record<string, unknown>> {
  return messages.map((message) => {
    if (message.role === 'tool') {
      const wire: Record<string, unknown> = {
        role: 'tool',
        tool_call_id: message.tool_call_id,
        content: message.content ?? '',
      };
      if (typeof message.name === 'string' && message.name.length > 0) {
        wire.name = message.name;
      }
      return wire;
    }

    if (message.role === 'assistant') {
      const toolCalls = message.tool_calls?.map(toWireToolCall);
      const hasToolCalls = Array.isArray(toolCalls) && toolCalls.length > 0;
      const text = typeof message.content === 'string' ? message.content : '';
      const wire: Record<string, unknown> = {
        role: 'assistant',
      };

      if (hasToolCalls) {
        // Gemini rejects empty-string content alongside tool_calls; null is accepted.
        wire.content = text.length > 0 ? text : null;
        wire.tool_calls = toolCalls;
      } else {
        wire.content = text;
      }

      return wire;
    }

    return {
      role: message.role,
      content: message.content ?? '',
    };
  });
}

export function resolveToolChatCompletionsUrl(route: ResolvedRoute): string {
  const baseUrl =
    route.providerType === 'gemini'
      ? GEMINI_OPENAI_COMPAT_BASE_URL
      : route.providerType === 'together'
        ? (route.togetherBaseUrl ?? TOGETHER_DEFAULT_BASE_URL)
        : route.providerType === 'openrouter'
          ? (route.openRouterBaseUrl ?? 'https://openrouter.ai/api/v1')
          : route.providerType === 'minimax'
            ? (route.miniMaxBaseUrl ?? 'https://api.minimax.io/v1')
            : TOGETHER_DEFAULT_BASE_URL;

  return `${baseUrl.replace(/\/$/, '')}/chat/completions`;
}

/**
 * Provider-specific chat/completions body extras.
 * Agent business logic stays provider-agnostic; quirks live here.
 */
export function buildToolChatProviderBodyExtras(
  route: ResolvedRoute,
  settings: ILlmGenerationRuntimeSettings,
): Record<string, unknown> {
  if (route.providerType === 'together') {
    return togetherReasoningBodyExtras(route.model, settings.disableReasoning);
  }

  if (route.providerType === 'minimax') {
    return {
      reasoning_split: true,
      ...(settings.disableReasoning ? { thinking: { type: 'disabled' } } : {}),
    };
  }

  return {};
}

/**
 * Honor the caller's stream preference for all providers.
 * Gemini thought signatures are captured from streamed tool_call deltas when
 * present; otherwise we retry once with non-stream (see below).
 */
export function shouldStreamToolChat(requestedStream: boolean): boolean {
  return requestedStream;
}

export function extractAssistantMessage(
  payload: unknown,
): ILlmToolChatMessage | null {
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.choices) ||
    payload.choices.length === 0
  ) {
    return null;
  }
  const choice = payload.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) {
    return null;
  }
  const message = choice.message;
  const content =
    typeof message.content === 'string' ? message.content : undefined;
  const toolCalls = Array.isArray(message.tool_calls)
    ? message.tool_calls
        .map((call) => parseWireToolCall(call))
        .filter((call): call is ILlmToolChatToolCall => call !== null)
    : undefined;

  return {
    role: 'assistant',
    content,
    tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
  };
}

function buildRequestHeaders(
  apiKey: string,
  providerType: ResolvedRoute['providerType'],
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

function mergeProviderMetadata(
  existing: ILlmToolChatProviderMetadata | undefined,
  incoming: ILlmToolChatProviderMetadata | undefined,
): ILlmToolChatProviderMetadata | undefined {
  if (!existing && !incoming) {
    return undefined;
  }
  if (!existing) {
    return incoming;
  }
  if (!incoming) {
    return existing;
  }

  const merged: ILlmToolChatProviderMetadata = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (isRecord(value) && isRecord(merged[key])) {
      merged[key] = { ...(merged[key] as Record<string, unknown>), ...value };
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function hasGeminiThoughtSignature(toolCall: ILlmToolChatToolCall): boolean {
  const extra = toolCall.providerMetadata?.extra_content;
  if (!isRecord(extra)) {
    return false;
  }
  const google = extra.google;
  if (!isRecord(google)) {
    return false;
  }
  return (
    typeof google.thought_signature === 'string' &&
    google.thought_signature.length > 0
  );
}

/**
 * Gemini multi-turn tool loops require thought_signature + stable tool call ids.
 * Streamed OpenAI-compat responses sometimes omit them; non-stream usually includes them.
 */
export function toolCallNeedsGeminiSignatureRetry(
  route: ResolvedRoute,
  message: ILlmToolChatMessage,
): boolean {
  if (route.providerType !== 'gemini') {
    return false;
  }
  const calls = message.tool_calls;
  if (!calls || calls.length === 0) {
    return false;
  }
  return calls.some(
    (call) => call.id.trim().length === 0 || !hasGeminiThoughtSignature(call),
  );
}

export function buildToolChatRequestBody(input: {
  route: ResolvedRoute;
  messages: ILlmToolChatMessage[];
  tools: ILlmOpenAiToolDefinition[];
  stream: boolean;
  settings: ILlmGenerationRuntimeSettings;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: input.route.model,
    messages: normalizeMessagesForWire(input.messages),
    stream: input.stream,
    temperature: input.settings.temperature,
    top_p: input.settings.topP,
    max_tokens: input.settings.maxOutputTokens,
    ...buildToolChatProviderBodyExtras(input.route, input.settings),
  };

  if (input.tools.length > 0) {
    body.tools = input.tools;
    body.tool_choice = 'auto';
  }

  return body;
}

function mapToolChatFinishReason(finishReason?: string): 'ok' | 'truncated' {
  if (finishReason === 'length') {
    return 'truncated';
  }
  return 'ok';
}

async function recordToolChatProviderUsage(params: {
  route: ResolvedRoute;
  usage: unknown;
  finishReason?: string;
  startedAt: number;
}): Promise<void> {
  const normalizedUsage =
    params.route.providerType === 'gemini'
      ? normalizeGeminiUsageMetadata(params.usage)
      : normalizeOpenAiCompatibleUsage(params.usage);

  await recordLlmProviderResult({
    providerKind: params.route.providerType,
    connectionId: params.route.connectionId,
    model: params.route.model,
    modality: 'text',
    usage: normalizedUsage ?? undefined,
    status: mapToolChatFinishReason(params.finishReason),
    finishReason: params.finishReason,
    durationMs: Date.now() - params.startedAt,
    callRole: 'agent_step',
  });
}

async function executeNonStreamToolChat(input: {
  route: ResolvedRoute;
  apiKey: string;
  messages: ILlmToolChatMessage[];
  tools: ILlmOpenAiToolDefinition[];
  settings: ILlmGenerationRuntimeSettings;
  onDelta?: (text: string) => void;
  emitDeltas: boolean;
}): Promise<ILlmToolChatMessage> {
  const startedAt = Date.now();
  const url = resolveToolChatCompletionsUrl(input.route);
  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(input.settings.requestTimeoutMs),
    headers: buildRequestHeaders(input.apiKey, input.route.providerType),
    body: JSON.stringify(
      buildToolChatRequestBody({
        route: input.route,
        messages: input.messages,
        tools: input.tools,
        stream: false,
        settings: input.settings,
      }),
    ),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '(unreadable)');
    throw new Error(`Tool chat API error ${response.status}: ${errorText}`);
  }

  const payload: unknown = await response.json();
  const message = extractAssistantMessage(payload);
  if (!message) {
    throw new Error('Malformed tool chat response');
  }

  if (isRecord(payload)) {
    const finishReason =
      Array.isArray(payload.choices) &&
      payload.choices.length > 0 &&
      isRecord(payload.choices[0]) &&
      typeof payload.choices[0].finish_reason === 'string'
        ? payload.choices[0].finish_reason
        : undefined;
    await recordToolChatProviderUsage({
      route: input.route,
      usage: payload.usage,
      finishReason,
      startedAt,
    });
  }

  const cleaned = stripRedactedThinking(message.content ?? '');
  if (input.emitDeltas && cleaned.length > 0) {
    // Emit in small chunks so the UI can animate even on non-stream provider turns
    // (e.g. Gemini thought-signature retry).
    const chunkSize = 32;
    for (let index = 0; index < cleaned.length; index += chunkSize) {
      input.onDelta?.(cleaned.slice(index, index + chunkSize));
    }
  }
  return {
    ...message,
    content: cleaned.length > 0 ? cleaned : message.content,
  };
}

async function executeStreamToolChat(input: {
  route: ResolvedRoute;
  apiKey: string;
  messages: ILlmToolChatMessage[];
  tools: ILlmOpenAiToolDefinition[];
  settings: ILlmGenerationRuntimeSettings;
  onDelta?: (text: string) => void;
}): Promise<ILlmToolChatMessage> {
  const startedAt = Date.now();
  const url = resolveToolChatCompletionsUrl(input.route);
  const thinkingFilter = createStreamingThinkingFilter();
  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(input.settings.requestTimeoutMs),
    headers: buildRequestHeaders(input.apiKey, input.route.providerType),
    body: JSON.stringify(
      buildToolChatRequestBody({
        route: input.route,
        messages: input.messages,
        tools: input.tools,
        stream: true,
        settings: input.settings,
      }),
    ),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '(unreadable)');
    throw new Error(`Tool chat API error ${response.status}: ${errorText}`);
  }

  if (!response.body) {
    throw new Error('Tool chat stream body missing');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let streamUsage: unknown;
  let streamFinishReason: string | undefined;
  const toolCallAccumulator = new Map<
    number,
    {
      id: string;
      name: string;
      arguments: string;
      providerMetadata?: ILlmToolChatProviderMetadata;
    }
  >();
  // Google often omits `index` on tool_call deltas; track by id when present.
  const idToIndex = new Map<string, number>();
  let nextIndex = 0;

  const resolveToolCallIndex = (call: Record<string, unknown>): number => {
    if (typeof call.index === 'number') {
      nextIndex = Math.max(nextIndex, call.index + 1);
      return call.index;
    }
    if (typeof call.id === 'string' && call.id.length > 0) {
      const existing = idToIndex.get(call.id);
      if (existing !== undefined) {
        return existing;
      }
      const assigned = nextIndex;
      nextIndex += 1;
      idToIndex.set(call.id, assigned);
      return assigned;
    }
    if (toolCallAccumulator.size > 0) {
      return Math.max(...toolCallAccumulator.keys());
    }
    const assigned = nextIndex;
    nextIndex += 1;
    return assigned;
  };

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

        if (
          !isRecord(payload) ||
          !Array.isArray(payload.choices) ||
          payload.choices.length === 0
        ) {
          if (isRecord(payload) && payload.usage !== undefined) {
            streamUsage = payload.usage;
          }
          continue;
        }

        if (isRecord(payload) && payload.usage !== undefined) {
          streamUsage = payload.usage;
        }

        const choice = payload.choices[0];
        if (!isRecord(choice)) {
          continue;
        }

        if (typeof choice.finish_reason === 'string') {
          streamFinishReason = choice.finish_reason;
        }

        if (!isRecord(choice.delta)) {
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
            const index = resolveToolCallIndex(call);
            const entry = toolCallAccumulator.get(index) ?? {
              id: '',
              name: '',
              arguments: '',
            };
            if (typeof call.id === 'string' && call.id.length > 0) {
              entry.id = call.id;
            }
            if (isRecord(call.function)) {
              if (
                typeof call.function.name === 'string' &&
                call.function.name.length > 0
              ) {
                entry.name = call.function.name;
              }
              if (typeof call.function.arguments === 'string') {
                entry.arguments += call.function.arguments;
              }
            }
            const incomingMetadata =
              extractProviderMetadataFromWireToolCall(call);
            entry.providerMetadata = mergeProviderMetadata(
              entry.providerMetadata,
              incomingMetadata,
            );
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

  await recordToolChatProviderUsage({
    route: input.route,
    usage: streamUsage,
    finishReason: streamFinishReason,
    startedAt,
  });

  const toolCalls = [...toolCallAccumulator.entries()]
    .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
    .filter(([, entry]) => entry.name.length > 0)
    .map(([, entry]) => ({
      // Prefer provider id; never invent one for Gemini (retry path will recover).
      id: entry.id,
      type: 'function' as const,
      function: { name: entry.name, arguments: entry.arguments || '{}' },
      ...(entry.providerMetadata
        ? { providerMetadata: entry.providerMetadata }
        : {}),
    }));

  return {
    role: 'assistant',
    content,
    tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

export async function callToolChatCompletions(input: {
  route: ResolvedRoute;
  apiKey: string;
  messages: ILlmToolChatMessage[];
  tools: ILlmOpenAiToolDefinition[];
  stream?: boolean;
  onDelta?: (text: string) => void;
}): Promise<ILlmToolChatMessage> {
  const preferStream = shouldStreamToolChat(input.stream ?? true);
  const settings = await readLlmGenerationRuntimeSettings();

  if (!preferStream) {
    return executeNonStreamToolChat({
      route: input.route,
      apiKey: input.apiKey,
      messages: input.messages,
      tools: input.tools,
      settings,
      onDelta: input.onDelta,
      emitDeltas: true,
    });
  }

  const streamed = await executeStreamToolChat({
    route: input.route,
    apiKey: input.apiKey,
    messages: input.messages,
    tools: input.tools,
    settings,
    onDelta: input.onDelta,
  });

  if (!toolCallNeedsGeminiSignatureRetry(input.route, streamed)) {
    // Fill missing ids only for non-Gemini providers.
    if (streamed.tool_calls) {
      return {
        ...streamed,
        tool_calls: streamed.tool_calls.map((call) => ({
          ...call,
          id: call.id || `${call.function.name}-${Date.now()}`,
        })),
      };
    }
    return streamed;
  }

  // Stream omitted Gemini thought signatures / ids. Retry non-stream for a
  // valid tool turn. Text deltas (if any) already streamed; tool rounds are
  // usually content-empty so this does not double-speak to the user.
  return executeNonStreamToolChat({
    route: input.route,
    apiKey: input.apiKey,
    messages: input.messages,
    tools: input.tools,
    settings,
    onDelta: input.onDelta,
    emitDeltas: !(streamed.content && streamed.content.length > 0),
  });
}
