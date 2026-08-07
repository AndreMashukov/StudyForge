import { describe, expect, it } from 'vitest';
import {
  applyRepairRouteFallbacks,
  isGenerationWorkflow,
  isRepairRouteFallbackKind,
} from '@shared-types';
import type { IGenerationRoutes } from '@shared-types';

function createMinimalRoutes(
  overrides?: Partial<IGenerationRoutes>
): IGenerationRoutes {
  const base = {
    connectionId: 'together-primary',
    model: 'test-model',
    modality: 'text',
    workflow: 'direct',
  } as const;

  const vision = { ...base, modality: 'vision' as const };
  const image = { ...base, modality: 'image' as const };
  const embedding = { ...base, modality: 'embedding' as const };

  const routes = {
    documentFromPrompt: { ...base, workflow: 'directWithRepair' as const },
    documentFromPromptRepair: { ...base },
    documentFromScreenshot: { ...vision },
    documentFromScreenshotRepair: { ...base },
    quiz: { ...base },
    flashcards: { ...base, workflow: 'agentic' as const },
    quizFollowup: { ...base },
    documentQuestion: { ...base },
    documentRevise: { ...base },
    directoryChat: { ...base },
    diagramQuiz: { ...base, workflow: 'agentic' as const },
    sequenceQuiz: { ...base },
    subjectWorld: { ...base },
    slideDeckText: { ...base },
    slideDeckImage: { ...image },
    sourceDocumentEnhancement: { ...base },
    ruleGeneration: { ...base },
    directoryAgent: { ...base },
    agentKnowledgeEmbedding: { ...embedding },
  } satisfies IGenerationRoutes;

  return { ...routes, ...overrides };
}

describe('generation workflow metadata', () => {
  it('accepts directWithRepair as a workflow', () => {
    expect(isGenerationWorkflow('directWithRepair')).toBe(true);
    expect(isGenerationWorkflow('direct')).toBe(true);
    expect(isGenerationWorkflow('agentic')).toBe(true);
    expect(isGenerationWorkflow('unknown')).toBe(false);
  });

  it('identifies repair route fallback kinds', () => {
    expect(isRepairRouteFallbackKind('documentFromPromptRepair')).toBe(true);
    expect(isRepairRouteFallbackKind('documentFromScreenshotRepair')).toBe(true);
    expect(isRepairRouteFallbackKind('documentFromPrompt')).toBe(false);
  });

  it('backfills missing repair routes from documentFromPrompt', () => {
    const routes = createMinimalRoutes();
    const withoutRepair = { ...routes } as IGenerationRoutes & {
      documentFromPromptRepair?: IGenerationRoutes['documentFromPromptRepair'];
      documentFromScreenshotRepair?: IGenerationRoutes['documentFromScreenshotRepair'];
    };
    delete withoutRepair.documentFromPromptRepair;
    delete withoutRepair.documentFromScreenshotRepair;

    const filled = applyRepairRouteFallbacks(withoutRepair as IGenerationRoutes);

    expect(filled.documentFromPromptRepair).toEqual({
      connectionId: routes.documentFromPrompt.connectionId,
      model: routes.documentFromPrompt.model,
      modality: 'text',
      workflow: 'direct',
    });
    expect(filled.documentFromScreenshotRepair.modality).toBe('text');
  });
});
