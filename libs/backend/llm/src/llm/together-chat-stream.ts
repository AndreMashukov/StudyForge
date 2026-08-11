import { createStreamingThinkingFilter } from './llm-response-text-utils';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export interface ITogetherStreamedChatResult {
  text: string | null;
  finishReason: string | null;
  contentLength: number;
  hasReasoning: boolean;
  reasoningLength: number;
}

/**
 * Consumes a Together/OpenAI-compatible chat.completions SSE body and returns
 * the buffered assistant text. Used for artifact generation (stream-and-buffer),
 * not for UI token streaming.
 */
export async function consumeTogetherChatCompletionStream(
  response: Response,
): Promise<ITogetherStreamedChatResult> {
  if (!response.body) {
    throw new Error('Together stream body missing');
  }

  const thinkingFilter = createStreamingThinkingFilter();
  const decoder = new TextDecoder();
  let lineBuffer = '';
  let cleanedContent = '';
  let reasoningLength = 0;
  let finishReason: string | null = null;

  const reader = response.body.getReader();
  const handlers = {
    thinkingFilter,
    onContentDelta: (delta: string) => {
      cleanedContent += delta;
    },
    onReasoningDelta: (delta: string) => {
      reasoningLength += delta.length;
    },
    onFinishReason: (reason: string) => {
      finishReason = reason;
    },
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        applySseDataLine(line, handlers);
      }
    }

    if (lineBuffer.trim().length > 0) {
      applySseDataLine(lineBuffer, handlers);
    }
  } finally {
    reader.releaseLock();
  }

  cleanedContent += thinkingFilter.finalize();
  const text = cleanedContent.length > 0 ? cleanedContent : null;

  return {
    text,
    finishReason,
    contentLength: cleanedContent.length,
    hasReasoning: reasoningLength > 0,
    reasoningLength,
  };
}

function applySseDataLine(
  line: string,
  handlers: {
    thinkingFilter: ReturnType<typeof createStreamingThinkingFilter>;
    onContentDelta: (delta: string) => void;
    onReasoningDelta: (delta: string) => void;
    onFinishReason: (reason: string) => void;
  },
): void {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) {
    return;
  }

  const data = trimmed.slice(5).trim();
  if (!data || data === '[DONE]') {
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return;
  }

  if (
    !isRecord(payload) ||
    !Array.isArray(payload.choices) ||
    payload.choices.length === 0
  ) {
    return;
  }

  const choice = payload.choices[0];
  if (!isRecord(choice)) {
    return;
  }

  if (typeof choice.finish_reason === 'string') {
    handlers.onFinishReason(choice.finish_reason);
  }

  if (!isRecord(choice.delta)) {
    return;
  }

  const delta = choice.delta;
  if (typeof delta.content === 'string' && delta.content.length > 0) {
    const cleanedDelta = handlers.thinkingFilter.append(delta.content);
    if (cleanedDelta.length > 0) {
      handlers.onContentDelta(cleanedDelta);
    }
  }

  if (typeof delta.reasoning === 'string' && delta.reasoning.length > 0) {
    handlers.onReasoningDelta(delta.reasoning);
  } else if (
    typeof delta.reasoning_content === 'string' &&
    delta.reasoning_content.length > 0
  ) {
    handlers.onReasoningDelta(delta.reasoning_content);
  }
}
