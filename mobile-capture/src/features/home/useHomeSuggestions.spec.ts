import { describe, expect, it, vi } from 'vitest';

vi.mock('@studyforge/client-data/statisticsFirestore', () => ({}));
vi.mock('../library/libraryData', () => ({}));
vi.mock('../../lib/storage/recentlyOpened', () => ({}));
vi.mock('@tanstack/react-query', () => ({}));

import { summarizeMissedSets } from './useHomeSuggestions';

describe('summarizeMissedSets', () => {
  it('counts failure groups per set and ranks the most-missed set first', () => {
    expect(
      summarizeMissedSets([
        { flashcardSetId: 'a', flashcardSetTitle: 'Organelles' },
        { flashcardSetId: 'b', flashcardSetTitle: 'Travel vocabulary' },
        { flashcardSetId: 'a', flashcardSetTitle: 'Organelles' },
      ]),
    ).toEqual([
      { flashcardSetId: 'a', title: 'Organelles', missed: 2 },
      { flashcardSetId: 'b', title: 'Travel vocabulary', missed: 1 },
    ]);
  });
});
