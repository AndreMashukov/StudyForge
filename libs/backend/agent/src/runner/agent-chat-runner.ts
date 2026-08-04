import * as functions from 'firebase-functions';
import { LlmGenerationRouteResolver } from '@study-forge/backend-llm/llm';
import { LlmProviderClientFactory } from '@study-forge/backend-llm/llm/llm-provider-client-factory';
import type { AgentMessageStreamEvent } from '@shared-types';
import type { AgentToolDefinition } from '../tools/create-agent-tools';
import { executeAgentTool, toolDefinitionsToOpenAiTools } from '../tools/create-agent-tools';

const MAX_TOOL_ROUNDS = 15;
const REQUEST_TIMEOUT_MS = 120_000;

interface ChatMessage {
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

function extractAssistantMessage(payload: unknown): ChatMessage | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices) || payload.choices.length === 0) {
    return null;
  }
  const choice = payload.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) {
    return null;
  }
  const message = choice.message;
  const role = message.role === 'assistant' ? 'assistant' : 'assistant';
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

  return { role, content, tool_calls: toolCalls };
}

async function callChatCompletions(input: {
  url: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools: ReturnType<typeof toolDefinitionsToOpenAiTools>;
  stream: boolean;
  onDelta?: (text: string) => void;
}): Promise<ChatMessage> {
  const response = await fetch(input.url, {
    method: 'POST',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      tools: input.tools,
      tool_choice: 'auto',
      stream: input.stream,
      temperature: 0.4,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '(unreadable)');
    throw new Error(`Agent chat API error ${response.status}: ${errorText}`);
  }

  if (!input.stream) {
    const payload: unknown = await response.json();
    const message = extractAssistantMessage(payload);
    if (!message) {
      throw new Error('Malformed agent chat response');
    }
    return message;
  }

  if (!response.body) {
    throw new Error('Agent chat stream body missing');
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
          input.onDelta?.(delta.content);
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

export interface AgentChatRunnerInput {
  userId: string;
  systemPrompt: string;
  userMessage: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools: AgentToolDefinition[];
  onEvent?: (event: AgentMessageStreamEvent) => void;
}

export class AgentChatRunner {
  static async run(input: AgentChatRunnerInput): Promise<string> {
    const resolution = await LlmGenerationRouteResolver.resolve('directoryAgent', {
      userId: input.userId,
    });

    if (resolution.route.providerType === 'gemini') {
      return AgentChatRunner.runWithAdkGemini(input, resolution.route.model);
    }

    const client = LlmProviderClientFactory.create(
      resolution.route,
      resolution.providerApiKey
    );

    void client;

    const baseUrl =
      resolution.route.togetherBaseUrl ??
      resolution.route.openRouterBaseUrl ??
      resolution.route.miniMaxBaseUrl ??
      'https://api.together.xyz/v1';
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

    if (!resolution.providerApiKey) {
      throw new Error('Agent chat provider credentials are missing');
    }

    const openAiTools = toolDefinitionsToOpenAiTools(input.tools);
    const messages: ChatMessage[] = [
      { role: 'system', content: input.systemPrompt },
      ...input.history.map((entry) => ({ role: entry.role, content: entry.content })),
      { role: 'user', content: input.userMessage },
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      input.onEvent?.({ type: 'status', message: round === 0 ? 'Thinking...' : 'Running tools...' });

      const assistantMessage = await callChatCompletions({
        url,
        apiKey: resolution.providerApiKey,
        model: resolution.route.model,
        messages,
        tools: openAiTools,
        stream: true,
        onDelta: (text) => input.onEvent?.({ type: 'delta', text }),
      });

      messages.push(assistantMessage);

      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        return assistantMessage.content?.trim() || 'Done.';
      }

      for (const toolCall of assistantMessage.tool_calls) {
        const args = parseToolArguments(toolCall.function.arguments);
        const result = await executeAgentTool(input.tools, toolCall.function.name, args);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: JSON.stringify(result),
        });
      }
    }

    return 'I hit the tool step limit while working on your request.';
  }

  private static async runWithAdkGemini(input: AgentChatRunnerInput, model: string): Promise<string> {
    const { FunctionTool, InMemoryRunner, LlmAgent } = await import('@google/adk');

    const functionTools = input.tools.map(
      (tool) =>
        new FunctionTool({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          execute: async (args) => tool.execute(args as Record<string, unknown>),
        })
    );

    const agent = new LlmAgent({
      name: 'study_forge_directory_agent',
      description: 'StudyForge workspace directory agent',
      instruction: input.systemPrompt,
      model,
      tools: functionTools,
    });

    const runner = new InMemoryRunner({ agent, appName: 'study-forge-directory-agent' });
    const session = await runner.sessionService.createSession({
      appName: 'study-forge-directory-agent',
      userId: input.userId,
      sessionId: `agent-${Date.now()}`,
    });

    let reply = '';

    for await (const event of runner.runAsync({
      userId: input.userId,
      sessionId: session.id,
      newMessage: {
        parts: [{ text: input.userMessage }],
      },
    })) {
      const textParts = event.content?.parts
        ?.map((part) => ('text' in part && typeof part.text === 'string' ? part.text : ''))
        .join('');

      if (textParts) {
        reply += textParts;
        input.onEvent?.({ type: 'delta', text: textParts });
      }
    }

    functions.logger.info('ADK directory agent completed', {
      userId: input.userId,
      model,
      replyLength: reply.length,
    });

    return reply.trim() || 'Done.';
  }
}
