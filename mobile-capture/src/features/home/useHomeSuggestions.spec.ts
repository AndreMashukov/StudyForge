import { describe, expect, it, vi } from 'vitest';

vi.mock('@studyforge/client-data/statisticsFirestore', () => ({}));
vi.mock('../library/libraryData', () => ({}));
vi.mock('../../lib/storage/recentlyOpened', () => ({}));
vi.mock('@tanstack/react-query', () => ({}));

import { summarizeMissedSets, toMillis } from './useHomeSuggestions';

describe('toMillis', () => {
  it('reads Timestamps, Timestamps restored from the persisted cache, dates and strings', () => {
    expect(toMillis({ toMillis: () => 1_700_000_000_000 })).toBe(
      1_700_000_000_000,
    );
    // JSON round trip of a Firestore Timestamp: no methods left.
    expect(
      toMillis(
        JSON.parse('{"seconds":1700000000,"nanoseconds":500000000}'),
      ),
    ).toBe(1_700_000_000_500);
    expect(toMillis(new Date(1_700_000_000_000))).toBe(1_700_000_000_000);
    expect(toMillis('2023-11-14T22:13:20.000Z')).toBe(1_700_000_000_000);
  });

  it('returns 0 for values it cannot read instead of throwing', () => {
    expect(toMillis(undefined)).toBe(0);
    expect(toMillis(null)).toBe(0);
    expect(toMillis({})).toBe(0);
    expect(toMillis('not a date')).toBe(0);
  });
});

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
