import {
  callToolChatCompletions,
  LlmGenerationRouteResolver,
  type ILlmToolChatMessage,
} from '@study-forge/backend-llm/llm';
import type { AgentMessageStreamEvent } from '@shared-types';
import type { AgentToolDefinition } from '../tools/create-agent-tools';
import { executeAgentTool, toolDefinitionsToOpenAiTools } from '../tools/create-agent-tools';

const MAX_TOOL_ROUNDS = 15;

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
    const resolution = await LlmGenerationRouteResolver.resolve('directoryChat', {
      userId: input.userId,
    });

    if (!resolution.providerApiKey) {
      throw new Error('Agent chat provider credentials are missing');
    }

    const openAiTools = toolDefinitionsToOpenAiTools(input.tools);
    const messages: ILlmToolChatMessage[] = [
      { role: 'system', content: input.systemPrompt },
      ...input.history.map((entry) => ({ role: entry.role, content: entry.content })),
      { role: 'user', content: input.userMessage },
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      input.onEvent?.({ type: 'status', message: round === 0 ? 'Thinking...' : 'Running tools...' });

      const assistantMessage = await callToolChatCompletions({
        route: resolution.route,
        apiKey: resolution.providerApiKey,
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
        let toolContent: string;
        try {
          const result = await executeAgentTool(input.tools, toolCall.function.name, args);
          toolContent = JSON.stringify(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Tool execution failed';
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

    return 'I hit the tool step limit while working on your request.';
  }
}
