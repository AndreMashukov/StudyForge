import { stripRedactedThinking } from './llm-response-text-utils';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractTextFromContentPart(part: unknown): string | null {
  if (typeof part === 'string' && part.length > 0) {
    return part;
  }
  if (!isRecord(part)) {
    return null;
  }
  if (typeof part.text === 'string' && part.text.length > 0) {
    return part.text;
  }
  return null;
}

/**
 * Normalizes Together/OpenAI-compatible message.content, which may be a string
 * or an array of text parts.
 */
export function normalizeTogetherMessageContent(content: unknown): string | null {
  if (typeof content === 'string') {
    return content.length > 0 ? content : null;
  }

  if (!Array.isArray(content) || content.length === 0) {
    return null;
  }

  const parts: string[] = [];
  for (const part of content) {
    const text = extractTextFromContentPart(part);
    if (text) {
      parts.push(text);
    }
  }

  if (parts.length === 0) {
    return null;
  }

  return parts.join('');
}

export interface ITogetherChatContentDiagnostics {
  hasChoices: boolean;
  choiceCount: number;
  finishReason: string | null;
  contentType: string;
  contentLength: number;
  hasReasoning: boolean;
  reasoningLength: number;
  usage: Record<string, unknown> | null;
}

export function summarizeTogetherChatPayload(
  payload: unknown
): ITogetherChatContentDiagnostics {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return {
      hasChoices: false,
      choiceCount: 0,
      finishReason: null,
      contentType: typeof payload,
      contentLength: 0,
      hasReasoning: false,
      reasoningLength: 0,
      usage: null,
    };
  }

  const choice = payload.choices[0];
  const message = isRecord(choice) && isRecord(choice.message) ? choice.message : null;
  const content = message?.content;
  const reasoning =
    (typeof message?.reasoning === 'string' && message.reasoning) ||
    (typeof message?.reasoning_content === 'string' && message.reasoning_content) ||
    '';
  const normalized = normalizeTogetherMessageContent(content);

  return {
    hasChoices: true,
    choiceCount: payload.choices.length,
    finishReason:
      isRecord(choice) && typeof choice.finish_reason === 'string'
        ? choice.finish_reason
        : null,
    contentType: Array.isArray(content) ? 'array' : typeof content,
    contentLength: normalized?.length ?? 0,
    hasReasoning: reasoning.length > 0,
    reasoningLength: reasoning.length,
    usage: isRecord(payload.usage) ? payload.usage : null,
  };
}

/**
 * Extracts assistant text from a Together chat-completions payload.
 * Strips leaked MiniMax thinking wrappers from content when present.
 */
export function parseTogetherChatContent(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices) || payload.choices.length === 0) {
    return null;
  }

  const choice = payload.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) {
    return null;
  }

  const raw = normalizeTogetherMessageContent(choice.message.content);
  if (!raw) {
    return null;
  }

  const text = stripRedactedThinking(raw);
  return text.length > 0 ? text : null;
}
