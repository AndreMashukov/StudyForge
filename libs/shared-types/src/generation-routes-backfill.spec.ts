import { describe, expect, it } from 'vitest';
import { backfillMissingGenerationRoute } from './generation-routes-backfill';

describe('backfillMissingGenerationRoute', () => {
  const diagramQuizRoute = {
    connectionId: 'together',
    model: 'minimax',
    modality: 'text' as const,
    workflow: 'agentic' as const,
  };

  it('inherits diagram quiz route for missing escalation', () => {
    expect(
      backfillMissingGenerationRoute(
        'escalation',
        null,
        diagramQuizRoute,
        false,
      ),
    ).toEqual({
      ...diagramQuizRoute,
      workflow: 'direct',
    });
  });

  it('keeps an explicit escalation route', () => {
    const escalationRoute = {
      ...diagramQuizRoute,
      model: 'gpt-4o',
      workflow: 'direct' as const,
    };
    expect(
      backfillMissingGenerationRoute(
        'escalation',
        escalationRoute,
        diagramQuizRoute,
        true,
      ),
    ).toBe(escalationRoute);
  });

  it('does not backfill an explicitly provided invalid escalation route', () => {
    expect(
      backfillMissingGenerationRoute(
        'escalation',
        null,
        diagramQuizRoute,
        true,
      ),
    ).toBeNull();
  });

  it('does not backfill other kinds', () => {
    expect(
      backfillMissingGenerationRoute('quiz', null, diagramQuizRoute, false),
    ).toBeNull();
  });

  const documentQuestionRoute = {
    connectionId: 'gemini-primary',
    model: 'gemini-2.5-flash',
    modality: 'text' as const,
    workflow: 'direct' as const,
  };

  it('inherits document question route for missing scratchPadQuestion', () => {
    expect(
      backfillMissingGenerationRoute(
        'scratchPadQuestion',
        null,
        diagramQuizRoute,
        false,
        documentQuestionRoute,
      ),
    ).toEqual(documentQuestionRoute);
  });

  it('uses the default decision route for a missing promptDiagramDecision', () => {
    expect(
      backfillMissingGenerationRoute(
        'promptDiagramDecision',
        null,
        diagramQuizRoute,
        false,
      ),
    ).toEqual({
      connectionId: 'openrouter-primary',
      model: 'typesafe/jev-1.13',
      modality: 'decision',
      workflow: 'direct',
    });
  });

  it('keeps an explicit promptDiagramDecision route', () => {
    const decisionRoute = {
      connectionId: 'openrouter-primary',
      model: 'google/gemini-decision-1',
      modality: 'decision' as const,
      workflow: 'direct' as const,
    };
    expect(
      backfillMissingGenerationRoute(
        'promptDiagramDecision',
        decisionRoute,
        diagramQuizRoute,
        true,
      ),
    ).toBe(decisionRoute);
  });

  it('does not backfill an explicitly provided invalid promptDiagramDecision route', () => {
    expect(
      backfillMissingGenerationRoute(
        'promptDiagramDecision',
        null,
        diagramQuizRoute,
        true,
      ),
    ).toBeNull();
  });
});
