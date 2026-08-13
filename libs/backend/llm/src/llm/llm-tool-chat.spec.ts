import { describe, expect, it } from 'vitest';
import {
  buildToolChatProviderBodyExtras,
  buildToolChatRequestBody,
  extractAssistantMessage,
  normalizeMessagesForWire,
  parseWireToolCall,
  resolveToolChatCompletionsUrl,
  shouldStreamToolChat,
  toWireToolCall,
  toolCallNeedsGeminiSignatureRetry,
  type ILlmToolChatMessage,
} from './llm-tool-chat';
import type { ResolvedRoute } from './types';

const geminiRoute: ResolvedRoute = {
  connectionId: 'gemini-primary',
  providerType: 'gemini',
  model: 'gemini-pro-latest',
  fallbackUsed: false,
};

const togetherRoute: ResolvedRoute = {
  connectionId: 'together-primary',
  providerType: 'together',
  model: 'MiniMaxAI/MiniMax-M3',
  fallbackUsed: false,
  togetherBaseUrl: 'https://api.together.ai/v1',
};

const minimaxRoute: ResolvedRoute = {
  connectionId: 'minimax-primary',
  providerType: 'minimax',
  model: 'MiniMax-M3',
  fallbackUsed: false,
  miniMaxBaseUrl: 'https://api.minimax.io/v1',
};

describe('resolveToolChatCompletionsUrl', () => {
  it('uses Gemini OpenAI-compat base URL', () => {
    expect(resolveToolChatCompletionsUrl(geminiRoute)).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    );
  });

  it('uses Together ai domain (not together.xyz)', () => {
    expect(resolveToolChatCompletionsUrl(togetherRoute)).toBe(
      'https://api.together.ai/v1/chat/completions',
    );
    expect(
      resolveToolChatCompletionsUrl({
        ...togetherRoute,
        togetherBaseUrl: undefined,
      }),
    ).toBe('https://api.together.ai/v1/chat/completions');
  });
});

describe('buildToolChatRequestBody', () => {
  const settings = {
    temperature: 0.2,
    topP: 0.9,
    topK: 40,
    maxOutputTokens: 1024,
    requestTimeoutMs: 30_000,
    disableReasoning: true,
  };

  it('omits tools and tool_choice when no tools are provided', () => {
    const body = buildToolChatRequestBody({
      route: togetherRoute,
      messages: [{ role: 'user', content: 'hello' }],
      tools: [],
      stream: false,
      settings,
    });

    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
    expect(body.model).toBe(togetherRoute.model);
  });

  it('includes tools and tool_choice auto when tools are provided', () => {
    const body = buildToolChatRequestBody({
      route: togetherRoute,
      messages: [{ role: 'user', content: 'list folders' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'list_directories',
            description: 'List directories',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
      stream: true,
      settings,
    });

    expect(body.tool_choice).toBe('auto');
    expect(body.tools).toHaveLength(1);
  });
});

describe('buildToolChatProviderBodyExtras', () => {
  it('disables reasoning for Together tool chat', () => {
    expect(buildToolChatProviderBodyExtras(togetherRoute)).toEqual({
      reasoning: { enabled: false },
    });
  });

  it('disables MiniMax thinking for native MiniMax', () => {
    expect(buildToolChatProviderBodyExtras(minimaxRoute)).toEqual({
      reasoning_split: true,
      thinking: { type: 'disabled' },
    });
  });

  it('adds no body extras for Gemini', () => {
    expect(buildToolChatProviderBodyExtras(geminiRoute)).toEqual({});
  });
});

describe('shouldStreamToolChat', () => {
  it('honors requestedStream for all providers including Gemini+tools', () => {
    expect(shouldStreamToolChat(true)).toBe(true);
    expect(shouldStreamToolChat(false)).toBe(false);
  });
});

describe('toolCallNeedsGeminiSignatureRetry', () => {
  it('retries when Gemini tool calls lack thought_signature', () => {
    expect(
      toolCallNeedsGeminiSignatureRetry(geminiRoute, {
        role: 'assistant',
        tool_calls: [
          {
            id: 'function-call-1',
            type: 'function',
            function: { name: 'list_rules', arguments: '{}' },
          },
        ],
      }),
    ).toBe(true);
  });

  it('does not retry when Gemini signatures are present', () => {
    expect(
      toolCallNeedsGeminiSignatureRetry(geminiRoute, {
        role: 'assistant',
        tool_calls: [
          {
            id: 'function-call-1',
            type: 'function',
            function: { name: 'list_rules', arguments: '{}' },
            providerMetadata: {
              extra_content: { google: { thought_signature: 'sig' } },
            },
          },
        ],
      }),
    ).toBe(false);
  });

  it('does not retry for Together', () => {
    expect(
      toolCallNeedsGeminiSignatureRetry(togetherRoute, {
        role: 'assistant',
        tool_calls: [
          {
            id: 'call-1',
            type: 'function',
            function: { name: 'list_rules', arguments: '{}' },
          },
        ],
      }),
    ).toBe(false);
  });
});

describe('Gemini thought_signature round-trip', () => {
  it('captures extra_content into providerMetadata', () => {
    const parsed = parseWireToolCall({
      id: 'function-call-1',
      type: 'function',
      function: { name: 'list_rules', arguments: '{}' },
      extra_content: {
        google: { thought_signature: 'sig-abc' },
      },
    });

    expect(parsed?.providerMetadata).toEqual({
      extra_content: {
        google: { thought_signature: 'sig-abc' },
      },
    });
  });

  it('restores extra_content on wire tool calls', () => {
    const wire = toWireToolCall({
      id: 'function-call-1',
      type: 'function',
      function: { name: 'list_rules', arguments: '{}' },
      providerMetadata: {
        extra_content: {
          google: { thought_signature: 'sig-abc' },
        },
      },
    });

    expect(wire).toEqual({
      id: 'function-call-1',
      type: 'function',
      function: { name: 'list_rules', arguments: '{}' },
      extra_content: {
        google: { thought_signature: 'sig-abc' },
      },
    });
  });

  it('echoes thought_signature through normalizeMessagesForWire', () => {
    const messages: ILlmToolChatMessage[] = [
      { role: 'user', content: 'attach the slide deck rule to Math' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'function-call-1',
            type: 'function',
            function: { name: 'list_rules', arguments: '{}' },
            providerMetadata: {
              extra_content: {
                google: { thought_signature: 'sig-abc' },
              },
            },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'function-call-1',
        name: 'list_rules',
        content: '[{"id":"r1","name":"Slide-Deck Generation"}]',
      },
    ];

    const wire = normalizeMessagesForWire(messages);
    expect(wire[1]).toMatchObject({
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'function-call-1',
          extra_content: {
            google: { thought_signature: 'sig-abc' },
          },
        },
      ],
    });
    expect(wire[2]).toMatchObject({
      role: 'tool',
      tool_call_id: 'function-call-1',
      name: 'list_rules',
    });
  });

  it('extracts thought_signature from non-stream assistant payloads', () => {
    const message = extractAssistantMessage({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'function-call-1',
                type: 'function',
                function: { name: 'list_directories', arguments: '{}' },
                extra_content: {
                  google: { thought_signature: 'sig-xyz' },
                },
              },
            ],
          },
        },
      ],
    });

    expect(message?.tool_calls?.[0]?.providerMetadata).toEqual({
      extra_content: {
        google: { thought_signature: 'sig-xyz' },
      },
    });
  });
});
