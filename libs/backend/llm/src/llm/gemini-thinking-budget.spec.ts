import { describe, expect, it } from 'vitest';
import {
  geminiModelAllowsDisablingThinking,
  resolveGeminiThinkingBudget,
} from './gemini-thinking-budget';

describe('geminiModelAllowsDisablingThinking', () => {
  it('allows flash models to disable thinking', () => {
    expect(geminiModelAllowsDisablingThinking('gemini-2.5-flash')).toBe(true);
    expect(geminiModelAllowsDisablingThinking('gemini-2.5-flash-lite')).toBe(
      true,
    );
  });

  it('rejects Pro and Gemini 3 models', () => {
    expect(geminiModelAllowsDisablingThinking('gemini-2.5-pro')).toBe(false);
    expect(geminiModelAllowsDisablingThinking('gemini-pro-latest')).toBe(false);
    expect(geminiModelAllowsDisablingThinking('gemini-3.1-pro-preview')).toBe(
      false,
    );
    expect(geminiModelAllowsDisablingThinking('gemini-3.6-flash')).toBe(false);
  });
});

describe('resolveGeminiThinkingBudget', () => {
  it('maps disableReasoning to 0 on flash', () => {
    expect(
      resolveGeminiThinkingBudget({
        model: 'gemini-2.5-flash',
        disableReasoning: true,
      }),
    ).toBe(0);
  });

  it('omits budget 0 on thinking-required models', () => {
    expect(
      resolveGeminiThinkingBudget({
        model: 'gemini-2.5-pro',
        disableReasoning: true,
      }),
    ).toBeUndefined();
    expect(
      resolveGeminiThinkingBudget({
        model: 'gemini-pro-latest',
        thinkingBudget: 0,
      }),
    ).toBeUndefined();
  });

  it('preserves explicit non-zero budgets', () => {
    expect(
      resolveGeminiThinkingBudget({
        model: 'gemini-2.5-pro',
        thinkingBudget: 128,
      }),
    ).toBe(128);
  });
});
