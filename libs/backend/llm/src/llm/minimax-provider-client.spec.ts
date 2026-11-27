import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase-functions', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  MiniMaxEmptyResponseError,
  MiniMaxProviderClient,
} from './minimax-provider-client';
import type { LlmTextConfig } from './types';

const fetchMock = vi.fn();

function chatResponse(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** What MiniMax-M3 returns when thinking uses the whole max_tokens budget. */
function reasoningOnlyResponse(maxTokens: number): Response {
  return chatResponse({
    choices: [
      {
        finish_reason: 'length',
        message: {
          role: 'assistant',
          reasoning_content: 'Let me check each rule against the fragment…',
          reasoning_details: [{ type: 'reasoning.text', text: '…' }],
        },
      },
    ],
    usage: {
      prompt_tokens: 6000,
      completion_tokens: maxTokens,
      total_tokens: 6000 + maxTokens,
      completion_tokens_details: { reasoning_tokens: maxTokens - 1 },
    },
  });
}

function answerResponse(content: string): Response {
  return chatResponse({
    choices: [
      { finish_reason: 'stop', message: { role: 'assistant', content } },
    ],
    usage: {
      prompt_tokens: 6000,
      completion_tokens: 300,
      total_tokens: 6300,
      completion_tokens_details: { reasoning_tokens: 0 },
    },
  });
}

function sentBody(callIndex: number): Record<string, unknown> {
  const init = fetchMock.mock.calls[callIndex]?.[1] as RequestInit;
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

const client = new MiniMaxProviderClient(
  'proxy-injected',
  'https://api.minimax.io/v1',
  'https://api.minimax.io/v1/image_generation',
  'minimax-primary',
);

const reasoningConfig: LlmTextConfig = {
  model: 'MiniMax-M3',
  maxOutputTokens: 8192,
  temperature: 0.2,
  disableReasoning: false,
};

describe('MiniMaxProviderClient.generateText', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns content without a retry when the first call answers', async () => {
    fetchMock.mockResolvedValueOnce(answerResponse('{"passed":true}'));

    const result = await client.generateText({
      prompt: 'critic prompt',
      config: reasoningConfig,
    });

    expect(result.text).toBe('{"passed":true}');
    expect(result.finishReason).toBe('stop');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBody(0).thinking).toBeUndefined();
  });

  it('retries with reasoning disabled when thinking consumed max_tokens', async () => {
    fetchMock
      .mockResolvedValueOnce(reasoningOnlyResponse(8192))
      .mockResolvedValueOnce(answerResponse('{"passed":true,"findings":[]}'));

    const result = await client.generateText({
      prompt: 'critic prompt',
      config: reasoningConfig,
    });

    expect(result.text).toBe('{"passed":true,"findings":[]}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(0).thinking).toBeUndefined();
    expect(sentBody(1).thinking).toEqual({ type: 'disabled' });
    expect(sentBody(1).max_tokens).toBe(8192);
    // Both calls are billed, so usage covers both.
    expect(result.usage).toMatchObject({
      inputTokens: 12000,
      outputTokens: 8192 + 300,
      reasoningTokens: 8191,
    });
  });

  it('retries when content holds only thinking wrappers', async () => {
    fetchMock
      .mockResolvedValueOnce(
        answerResponse('<mm:think>still thinking</mm:think>'),
      )
      .mockResolvedValueOnce(answerResponse('<p>answer</p>'));

    const result = await client.generateText({
      prompt: 'p',
      config: reasoningConfig,
    });

    expect(result.text).toBe('<p>answer</p>');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry when reasoning was already disabled', async () => {
    fetchMock.mockResolvedValueOnce(reasoningOnlyResponse(16384));

    const error = await client
      .generateText({
        prompt: 'p',
        config: { ...reasoningConfig, disableReasoning: true },
      })
      .catch((caught: unknown) => caught);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(MiniMaxEmptyResponseError);
  });

  it('throws a diagnostic error when the reasoning-disabled retry is also empty', async () => {
    fetchMock
      .mockResolvedValueOnce(reasoningOnlyResponse(8192))
      .mockResolvedValueOnce(
        chatResponse({
          choices: [{ finish_reason: 'stop', message: { content: '' } }],
        }),
      );

    const error = await client
      .generateText({ prompt: 'p', config: reasoningConfig })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MiniMaxEmptyResponseError);
    const message = (error as Error).message;
    expect(message).toMatch(/^Empty response from MiniMax API \(/);
    expect(message).toContain('finish_reason=stop');
    expect(message).toContain('max_tokens=8192');
    expect(message).toContain('also empty with reasoning disabled');
  });

  it('reports finish_reason and reasoning tokens in the error', async () => {
    fetchMock.mockResolvedValueOnce(reasoningOnlyResponse(8192));

    const error = await client
      .generateText({
        prompt: 'p',
        config: { ...reasoningConfig, disableReasoning: true },
      })
      .catch((caught: unknown) => caught);

    expect((error as MiniMaxEmptyResponseError).details).toMatchObject({
      finishReason: 'length',
      reasoningTokens: 8191,
      outputTokens: 8192,
      maxOutputTokens: 8192,
      reasoningEnabled: false,
      afterReasoningFallback: false,
    });
  });

  it('keeps HTTP errors as before', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('rate limited', { status: 429 }),
    );

    await expect(
      client.generateText({ prompt: 'p', config: reasoningConfig }),
    ).rejects.toThrow('MiniMax API error 429: rate limited');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('MiniMaxProviderClient.generateVisionText', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies the same reasoning fallback and sends the image part', async () => {
    fetchMock
      .mockResolvedValueOnce(reasoningOnlyResponse(8192))
      .mockResolvedValueOnce(answerResponse('<p>extracted</p>'));

    const result = await client.generateVisionText({
      prompt: 'extract',
      imageDataUrl: 'data:image/png;base64,AAAA',
      config: reasoningConfig,
    });

    expect(result.text).toBe('<p>extracted</p>');
    const messages = sentBody(1).messages as Array<{ content: unknown }>;
    expect(messages[0].content).toEqual([
      { type: 'text', text: 'extract' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
    ]);
  });
});
