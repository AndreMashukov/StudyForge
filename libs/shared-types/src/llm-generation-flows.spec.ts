import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LLM_GENERATION_SETTINGS,
  resolveLlmGenerationFlowRuntimeSettings,
} from './index';
import {
  applyLlmGenerationFlowOverrides,
  DEFAULT_LLM_GENERATION_FLOWS,
} from './llm-generation-flows';

describe('applyLlmGenerationFlowOverrides', () => {
  it('applies seed values over global', () => {
    const base = {
      ...DEFAULT_LLM_GENERATION_SETTINGS,
      maxOutputTokens: 1000,
      temperature: 0.9,
    };
    const resolved = applyLlmGenerationFlowOverrides(base, 'sequenceQuiz');
    expect(resolved.maxOutputTokens).toBe(
      DEFAULT_LLM_GENERATION_FLOWS.sequenceQuiz.maxOutputTokens,
    );
    expect(resolved.temperature).toBe(
      DEFAULT_LLM_GENERATION_FLOWS.sequenceQuiz.temperature,
    );
  });

  it('lets admin stored flows beat seed values', () => {
    const base = { ...DEFAULT_LLM_GENERATION_SETTINGS };
    const resolved = applyLlmGenerationFlowOverrides(base, 'sequenceQuiz', {
      sequenceQuiz: { maxOutputTokens: 40_000 },
    });
    expect(resolved.maxOutputTokens).toBe(40_000);
  });
});

describe('resolveLlmGenerationFlowRuntimeSettings', () => {
  it('resolves flow → global without using profiles', () => {
    const resolved = resolveLlmGenerationFlowRuntimeSettings(
      {
        ...DEFAULT_LLM_GENERATION_SETTINGS,
        maxOutputTokens: 1000,
        temperature: 0.9,
      },
      {
        profileId: 'structuredArtifact',
        flowId: 'flashcards.languageClassify',
      },
    );
    expect(resolved.maxOutputTokens).toBe(1024);
    expect(resolved.temperature).toBe(0.1);
    expect(resolved.disableReasoning).toBe(true);
  });
});
