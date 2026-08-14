import type { Content, Part } from '@google/genai';
import type {
  ILlmOpenAiToolDefinition,
  ILlmToolChatMessage,
} from '@study-forge/backend-llm/llm';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function partText(part: Part): string {
  return typeof part.text === 'string' ? part.text : '';
}

function functionCallArgs(part: Part): string {
  const args = part.functionCall?.args;
  if (!args || typeof args !== 'object') {
    return '{}';
  }
  return JSON.stringify(args);
}

function thoughtSignatureFromPart(
  part: Part,
): Record<string, unknown> | undefined {
  if (!isRecord(part)) {
    return undefined;
  }
  const extra = part['thoughtSignature'];
  if (typeof extra === 'string' && extra.length > 0) {
    return { thoughtSignature: extra };
  }
  return undefined;
}

const GEMINI_SCHEMA_TYPE_TO_JSON: Record<string, string> = {
  OBJECT: 'object',
  STRING: 'string',
  NUMBER: 'number',
  INTEGER: 'integer',
  BOOLEAN: 'boolean',
  ARRAY: 'array',
  NULL: 'null',
};

function toOpenAiJsonSchema(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return { type: 'object', properties: {} };
  }

  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (key === 'type' && typeof nested === 'string') {
      result[key] = GEMINI_SCHEMA_TYPE_TO_JSON[nested] ?? nested;
      continue;
    }
    if (Array.isArray(nested)) {
      result[key] = nested.map((item) =>
        isRecord(item) ? toOpenAiJsonSchema(item) : item,
      );
      continue;
    }
    if (isRecord(nested)) {
      result[key] = toOpenAiJsonSchema(nested);
      continue;
    }
    result[key] = nested;
  }
  return result;
}

function functionDeclarationsFromTools(
  tools: unknown,
): Array<Record<string, unknown>> {
  if (!Array.isArray(tools)) {
    return [];
  }

  return tools.flatMap((tool) => {
    if (!isRecord(tool)) {
      return [];
    }
    const declarations = tool['functionDeclarations'];
    if (!Array.isArray(declarations)) {
      return [];
    }
    return declarations.filter(isRecord);
  });
}

export function readSystemInstruction(
  systemInstruction: unknown,
): string | undefined {
  if (
    typeof systemInstruction === 'string' &&
    systemInstruction.trim().length > 0
  ) {
    return systemInstruction.trim();
  }
  if (!isRecord(systemInstruction)) {
    return undefined;
  }
  const parts = systemInstruction['parts'];
  if (Array.isArray(parts)) {
    const text = parts
      .map((part) =>
        isRecord(part) && typeof part['text'] === 'string' ? part['text'] : '',
      )
      .join('');
    return text.trim().length > 0 ? text.trim() : undefined;
  }
  const text = systemInstruction['text'];
  if (typeof text === 'string') {
    return text.trim() || undefined;
  }
  return undefined;
}

export function geminiContentsToToolChatMessages(
  contents: Content[],
): ILlmToolChatMessage[] {
  const messages: ILlmToolChatMessage[] = [];

  for (const content of contents) {
    const parts = content.parts ?? [];
    const role = content.role === 'model' ? 'assistant' : 'user';
    const text = parts.map((part) => partText(part)).join('');
    const functionCalls = parts.filter((part) => part.functionCall);
    const functionResponses = parts.filter((part) => part.functionResponse);

    if (functionResponses.length > 0) {
      for (const part of functionResponses) {
        const response = part.functionResponse;
        messages.push({
          role: 'tool',
          name: response?.name,
          tool_call_id: response?.id,
          content: JSON.stringify(response?.response ?? {}),
        });
      }
      continue;
    }

    if (functionCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: text.length > 0 ? text : null,
        tool_calls: functionCalls.map((part, index) => {
          const call = part.functionCall;
          const metadata = thoughtSignatureFromPart(part);
          return {
            id: call?.id || `${call?.name ?? 'tool'}-${index}`,
            type: 'function' as const,
            function: {
              name: call?.name ?? '',
              arguments: functionCallArgs(part),
            },
            ...(metadata ? { providerMetadata: metadata } : {}),
          };
        }),
      });
      continue;
    }

    messages.push({
      role,
      content: text,
    });
  }

  return messages;
}

export function llmRequestToOpenAiTools(
  request: unknown,
): ILlmOpenAiToolDefinition[] {
  const config =
    isRecord(request) && isRecord(request['config'])
      ? request['config']
      : undefined;
  const declarations = functionDeclarationsFromTools(config?.['tools']);

  return declarations
    .map((declaration) => {
      const name = asString(declaration['name']);
      if (!name) {
        return null;
      }
      const parameters = isRecord(declaration['parametersJsonSchema'])
        ? declaration['parametersJsonSchema']
        : isRecord(declaration['parameters'])
          ? declaration['parameters']
          : { type: 'object', properties: {} };
      return {
        type: 'function' as const,
        function: {
          name,
          description: asString(declaration['description']) ?? '',
          parameters: toOpenAiJsonSchema(parameters),
        },
      };
    })
    .filter((tool): tool is ILlmOpenAiToolDefinition => tool !== null);
}

export function toolChatAssistantToContent(
  message: ILlmToolChatMessage,
): Content {
  const parts: Part[] = [];
  if (typeof message.content === 'string' && message.content.length > 0) {
    parts.push({ text: message.content });
  }

  for (const toolCall of message.tool_calls ?? []) {
    let args: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(toolCall.function.arguments);
      if (isRecord(parsed)) {
        args = parsed;
      }
    } catch {
      args = {};
    }
    const part: Part = {
      functionCall: {
        id: toolCall.id,
        name: toolCall.function.name,
        args,
      },
    };
    const signature = toolCall.providerMetadata?.thoughtSignature;
    if (typeof signature === 'string') {
      Object.assign(part, { thoughtSignature: signature });
    }
    parts.push(part);
  }

  if (parts.length === 0) {
    parts.push({ text: '' });
  }

  return { role: 'model', parts };
}
