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
});
