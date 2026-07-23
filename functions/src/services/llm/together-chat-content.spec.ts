import { describe, expect, it } from 'vitest';
import {
  normalizeTogetherMessageContent,
  parseTogetherChatContent,
  summarizeTogetherChatPayload,
} from './together-chat-content';
import { stripRedactedThinking } from './llm-response-text-utils';

describe('normalizeTogetherMessageContent', () => {
  it('returns string content', () => {
    expect(normalizeTogetherMessageContent('hello')).toBe('hello');
  });

  it('joins text parts from content arrays', () => {
    expect(
      normalizeTogetherMessageContent([
        { type: 'text', text: '{"cards":' },
        { type: 'text', text: '[]}' },
      ])
    ).toBe('{"cards":[]}');
  });

  it('returns null for empty content', () => {
    expect(normalizeTogetherMessageContent('')).toBeNull();
    expect(normalizeTogetherMessageContent([])).toBeNull();
    expect(normalizeTogetherMessageContent(null)).toBeNull();
  });
});

describe('parseTogetherChatContent', () => {
  it('parses standard assistant content', () => {
    const payload = {
      choices: [{ message: { role: 'assistant', content: '[{"front":"a","back":"b"}]' } }],
    };
    expect(parseTogetherChatContent(payload)).toBe('[{"front":"a","back":"b"}]');
  });

  it('returns null when content is empty but reasoning is present', () => {
    const payload = {
      choices: [
        {
          finish_reason: 'length',
          message: {
            role: 'assistant',
            content: '',
            reasoning: 'I am still thinking about flashcards...',
          },
        },
      ],
    };
    expect(parseTogetherChatContent(payload)).toBeNull();
  });

  it('strips leaked thinking wrappers from content', () => {
    const payload = {
      choices: [
        {
          message: {
            role: 'assistant',
            content:
              '<mm:think>plan the cards</mm:think>\n[{"front":"q","back":"a"}]',
          },
        },
      ],
    };
    expect(parseTogetherChatContent(payload)).toBe('[{"front":"q","back":"a"}]');
  });
});

describe('summarizeTogetherChatPayload', () => {
  it('reports truncation diagnostics for reasoning-only responses', () => {
    const summary = summarizeTogetherChatPayload({
      choices: [
        {
          finish_reason: 'length',
          message: {
            content: '',
            reasoning: 'abcdefghij',
          },
        },
      ],
      usage: { completion_tokens: 8192 },
    });

    expect(summary.finishReason).toBe('length');
    expect(summary.hasReasoning).toBe(true);
    expect(summary.reasoningLength).toBe(10);
    expect(summary.contentLength).toBe(0);
    expect(summary.usage).toEqual({ completion_tokens: 8192 });
  });
});

describe('stripRedactedThinking', () => {
  it('removes redacted_thinking and mm:think wrappers', () => {
    const input =
      '<redacted_thinking>hidden</redacted_thinking>keep' +
      '<mm:think>also hidden</mm:think>-me';
    expect(stripRedactedThinking(input)).toBe('keep-me');
  });
});
