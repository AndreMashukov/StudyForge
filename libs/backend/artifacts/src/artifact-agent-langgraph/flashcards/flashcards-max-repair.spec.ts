import { describe, expect, it } from 'vitest';

import { flashcardsDefinition } from '../../flashcards/flashcard-definition';
import { FLASHCARDS_MAX_REPAIR_ITERATIONS } from './flashcards-graph';

describe('FLASHCARDS_MAX_REPAIR_ITERATIONS', () => {
  it('matches flashcardsDefinition.limits.maxRepairIterations', () => {
    expect(FLASHCARDS_MAX_REPAIR_ITERATIONS).toBe(
      flashcardsDefinition.limits.maxRepairIterations
    );
  });
});
