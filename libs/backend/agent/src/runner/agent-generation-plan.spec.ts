import { describe, expect, it } from 'vitest';
import {
  AGENT_GENERATION_LIMITS,
  assertGenerationBatchAllowed,
  estimateGenerationCredits,
  evaluateGenerationPlan,
  formatGenerationEstimate,
} from './agent-generation-plan';

describe('agent-generation-plan', () => {
  it('estimates credits from default costs', () => {
    expect(
      estimateGenerationCredits({
        documents: 1,
        quizzes: 1,
        flashcardSets: 1,
      }),
    ).toBe(35);
  });

  it('allows plans within hard limits', () => {
    const evaluation = evaluateGenerationPlan({
      documents: 1,
      quizzes: 2,
      flashcardSets: 1,
    });
    expect(evaluation.requiresConfirmation).toBe(false);
    expect(evaluation.exceedsHardLimits).toBe(false);
  });

  it('requires confirmation when credits exceed 100', () => {
    const evaluation = evaluateGenerationPlan({
      documents: 5,
      quizzes: 5,
      flashcardSets: 2,
    });
    expect(evaluation.estimatedCredits).toBe(145);
    expect(evaluation.requiresConfirmation).toBe(true);
  });

  it('throws when a generation batch would exceed hard limits', () => {
    expect(() =>
      assertGenerationBatchAllowed(
        {
          documents: AGENT_GENERATION_LIMITS.maxDocuments,
          quizzes: 0,
          flashcardSets: 0,
        },
        { documents: 1 },
      ),
    ).toThrow(/Generation limit exceeded/);
  });

  it('formats a readable estimate', () => {
    expect(
      formatGenerationEstimate({
        documents: 1,
        quizzes: 1,
        flashcardSets: 0,
      }),
    ).toContain('Estimated total: 25 credits');
  });
});
