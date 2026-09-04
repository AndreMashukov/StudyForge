import { describe, expect, it } from 'vitest';
import { togetherReasoningBodyExtras } from './together-reasoning-body';

describe('togetherReasoningBodyExtras', () => {
  it('returns nothing when reasoning stays enabled', () => {
    expect(togetherReasoningBodyExtras('MiniMaxAI/MiniMax-M3', false)).toEqual(
      {},
    );
  });

  it('sends both Together and MiniMax disable fields for every Together model', () => {
    const expected = {
      reasoning: { enabled: false },
      thinking: { type: 'disabled' },
    };

    expect(togetherReasoningBodyExtras('MiniMaxAI/MiniMax-M3', true)).toEqual(
      expected,
    );
    expect(togetherReasoningBodyExtras('Qwen/Qwen3.8-2.4T-A95B', true)).toEqual(
      expected,
    );
    expect(togetherReasoningBodyExtras('zai-org/GLM-5.2', true)).toEqual(
      expected,
    );
  });
});
