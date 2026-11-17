import {
  type AgentMessageStreamEvent,
  agentMessageStreamEventSchema,
} from '@shared-types';

export function parseSseBlock(block: string): AgentMessageStreamEvent | null {
  const lines = block.split('\n');
  let eventType: string | undefined;
  let dataLine: string | undefined;

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLine = line.slice(5).trim();
    }
  }

  if (!dataLine) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(dataLine);
    const validated = agentMessageStreamEventSchema.safeParse(parsed);
    if (validated.success) {
      return validated.data;
    }
    if (
      eventType === 'error' &&
      typeof parsed === 'object' &&
      parsed !== null
    ) {
      const message =
        'message' in parsed && typeof parsed.message === 'string'
          ? parsed.message
          : 'Agent stream error';
      return { type: 'error', message };
    }
  } catch {
    return null;
  }

  return null;
}

export async function* parseAgentMessageSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AgentMessageStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        const event = parseSseBlock(block.trim());
        if (event) {
          yield event;
        }
      }
    }

    if (buffer.trim()) {
      const event = parseSseBlock(buffer.trim());
      if (event) {
        yield event;
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Stream may already be closed.
    }
    reader.releaseLock();
  }
}
