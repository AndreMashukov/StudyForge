import { beforeEach, describe, expect, it, vi } from 'vitest';
import { patchProviderCostContext } from '@study-forge/backend-core/services/provider-cost';
import { LlmGenerationRouteResolver } from '@study-forge/backend-llm/llm';
import { StudyForgeAdkLlm } from './studyforge-adk-llm';

vi.mock('@study-forge/backend-core/services/provider-cost', () => ({
  patchProviderCostContext: vi.fn(),
}));

vi.mock('@study-forge/backend-llm/llm', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@study-forge/backend-llm/llm')
  >();
  return {
    ...actual,
    LlmGenerationRouteResolver: {
      resolve: vi.fn(),
    },
    callToolChatCompletions: vi.fn().mockResolvedValue({
      role: 'assistant',
      content: '{"type":"response","response":"ok"}',
    }),
  };
});

describe('StudyForgeAdkLlm provider cost context', () => {
  beforeEach(() => {
    vi.mocked(LlmGenerationRouteResolver.resolve).mockResolvedValue({
      route: {
        connectionId: 'conn-1',
        model: 'test-model',
        providerType: 'openai',
      },
      providerApiKey: 'test-key',
      userGroupId: 'group-1',
      llmSetupId: 'setup-1',
      kind: 'agentExecutor',
      workflow: 'direct',
      modality: 'text',
    });
  });

  it('patches generationKind to agentExecutor before resolving the route', async () => {
    const llm = new StudyForgeAdkLlm({
      userId: 'user-1',
      generationKind: 'agentExecutor',
    });

    const generator = llm.generateContentAsync({
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
      config: { systemInstruction: 'system' },
    });

    await generator.next();

    expect(patchProviderCostContext).toHaveBeenCalledWith({
      generationKind: 'agentExecutor',
    });
    expect(LlmGenerationRouteResolver.resolve).toHaveBeenCalledWith(
      'agentExecutor',
      { userId: 'user-1' },
    );
  });

  it('patches generationKind to directoryAgent for planner calls', async () => {
    const llm = new StudyForgeAdkLlm({
      userId: 'user-1',
      generationKind: 'directoryAgent',
    });

    const generator = llm.generateContentAsync({
      contents: [{ role: 'user', parts: [{ text: 'plan this' }] }],
      config: { systemInstruction: 'system' },
    });

    await generator.next();

    expect(patchProviderCostContext).toHaveBeenCalledWith({
      generationKind: 'directoryAgent',
    });
    expect(LlmGenerationRouteResolver.resolve).toHaveBeenCalledWith(
      'directoryAgent',
      { userId: 'user-1' },
    );
  });
});
