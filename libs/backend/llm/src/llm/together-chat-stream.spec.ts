import { describe, expect, it } from 'vitest';
import { consumeTogetherChatCompletionStream } from './together-chat-stream';

function sseResponse(chunks: string[]): Response {
  const body = chunks.join('');
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function contentChunk(content: string, finishReason: string | null = null): string {
  return (
    `data: ${JSON.stringify({
      choices: [
        {
          delta: { content },
          finish_reason: finishReason,
        },
      ],
    })}\n\n`
  );
}

describe('consumeTogetherChatCompletionStream', () => {
  it('buffers assistant content from SSE deltas', async () => {
    const result = await consumeTogetherChatCompletionStream(
      sseResponse([
        contentChunk('{"cards":'),
        contentChunk('[1]}', 'stop'),
        'data: [DONE]\n\n',
      ]),
    );

    expect(result.text).toBe('{"cards":[1]}');
    expect(result.finishReason).toBe('stop');
    expect(result.contentLength).toBe('{"cards":[1]}'.length);
    expect(result.hasReasoning).toBe(false);
  });

  it('strips thinking wrappers across streamed chunks', async () => {
    const thinkingOpen = `<${'redacted'}_${'thinking'}>`;
    const thinkingClose = `</${'redacted'}_${'thinking'}>`;
    const result = await consumeTogetherChatCompletionStream(
      sseResponse([
        contentChunk(`visible${thinkingOpen}`),
        contentChunk('hidden'),
        contentChunk(`${thinkingClose}tail`, 'stop'),
        'data: [DONE]\n\n',
      ]),
    );

    expect(result.text).toBe('visibletail');
  });

  it('tracks reasoning length without including it in text', async () => {
    const result = await consumeTogetherChatCompletionStream(
      sseResponse([
        `data: ${JSON.stringify({
          choices: [
            {
              delta: { content: '', reasoning: 'plan-' },
              finish_reason: null,
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          choices: [
            {
              delta: { content: 'OK', reasoning: 'done' },
              finish_reason: 'stop',
            },
          ],
        })}\n\n`,
        'data: [DONE]\n\n',
      ]),
    );

    expect(result.text).toBe('OK');
    expect(result.hasReasoning).toBe(true);
    expect(result.reasoningLength).toBe('plan-done'.length);
    expect(result.finishReason).toBe('stop');
  });

  it('returns null text when only reasoning was streamed', async () => {
    const result = await consumeTogetherChatCompletionStream(
      sseResponse([
        `data: ${JSON.stringify({
          choices: [
            {
              delta: { content: '', reasoning: 'still thinking' },
              finish_reason: 'length',
            },
          ],
        })}\n\n`,
        'data: [DONE]\n\n',
      ]),
    );

    expect(result.text).toBeNull();
    expect(result.finishReason).toBe('length');
    expect(result.hasReasoning).toBe(true);
    expect(result.reasoningLength).toBe('still thinking'.length);
  });

  it('captures usage from a trailing chunk with empty choices', async () => {
    const result = await consumeTogetherChatCompletionStream(
      sseResponse([
        contentChunk('Hello', 'stop'),
        `data: ${JSON.stringify({
          choices: [],
          usage: {
            prompt_tokens: 120,
            completion_tokens: 40,
            total_tokens: 160,
          },
        })}\n\n`,
        'data: [DONE]\n\n',
      ]),
    );

    expect(result.text).toBe('Hello');
    expect(result.usage).toEqual({
      inputTokens: 120,
      outputTokens: 40,
      totalTokens: 160,
    });
  });
});
