import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DirectoryItemSummary } from '@shared-types';
import {
  buildGroupedFlashcardFailures,
  fetchFlashcardStudySessionsPage,
  getHiddenFailureGroupKeys,
} from '@studyforge/client-data/statisticsFirestore';
import { queryKeys } from '../../lib/api/queryKeys';
import { getRecentlyOpened } from '../../lib/storage/recentlyOpened';
import { useDirectoryItems } from '../library/libraryData';
import type { ILibraryItemRef } from '../library/itemNavigation';

export interface IHomeSuggestion {
  key: 'continue' | 'review' | 'capture';
  label: string;
  title: string;
  item: ILibraryItemRef;
}

/** Statistics failure groups from the last 30 days, grouped per flashcard set. */
export function summarizeMissedSets(
  failures: Array<{ flashcardSetId: string; flashcardSetTitle?: string }>,
): Array<{ flashcardSetId: string; title: string; missed: number }> {
  const bySet = new Map<
    string,
    { flashcardSetId: string; title: string; missed: number }
  >();
  for (const failure of failures) {
    const entry = bySet.get(failure.flashcardSetId) ?? {
      flashcardSetId: failure.flashcardSetId,
      title: failure.flashcardSetTitle ?? 'Flashcards',
      missed: 0,
    };
    entry.missed += 1;
    bySet.set(failure.flashcardSetId, entry);
  }
  return [...bySet.values()].sort(
    (a, b) => b.missed - a.missed || a.title.localeCompare(b.title),
  );
}

function toMillis(
  value: DirectoryItemSummary['createdAt'] | undefined,
): number {
  if (!value) return 0;
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (value instanceof Date) return value.getTime();
  return value.toMillis();
}

function isoDaysAgo(days: number): string {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Home cards from data that already exists (decision 8): last opened document on
 * this device, the flashcard set with the most missed cards, and the newest capture.
 */
export function useHomeSuggestions(
  userId: string | undefined,
  defaultDirectoryId: string | null,
  active: boolean,
): IHomeSuggestion[] {
  const missedQuery = useQuery({
    queryKey: queryKeys.missedFlashcards(userId ?? ''),
    enabled: Boolean(userId) && active,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      if (!userId) return [];
      const [page, hidden] = await Promise.all([
        fetchFlashcardStudySessionsPage(userId, { startDate: isoDaysAgo(30) }),
        getHiddenFailureGroupKeys(userId),
      ]);
      const failures = await buildGroupedFlashcardFailures(
        userId,
        page.sessions,
        hidden,
      );
      return summarizeMissedSets(failures);
    },
  });
  const captureItems = useDirectoryItems(userId, defaultDirectoryId, active);

  return useMemo(() => {
    const suggestions: IHomeSuggestion[] = [];
    const lastDocument = getRecentlyOpened().find(
      (item) => item.itemType === 'document',
    );
    if (lastDocument) {
      suggestions.push({
        key: 'continue',
        label: 'Continue reading',
        title: lastDocument.title,
        item: {
          itemType: 'document',
          id: lastDocument.id,
          title: lastDocument.title,
          directoryId: lastDocument.directoryId,
        },
      });
    }
    const topMissed = missedQuery.data?.[0];
    if (topMissed) {
      suggestions.push({
        key: 'review',
        label: `Review ${topMissed.missed} missed card${topMissed.missed === 1 ? '' : 's'}`,
        title: topMissed.title,
        item: {
          itemType: 'flashcard',
          id: topMissed.flashcardSetId,
          title: topMissed.title,
        },
      });
    }
    const newest = [...(captureItems.data ?? [])]
      .filter((item) => item.itemType === 'document')
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))[0];
    if (newest) {
      suggestions.push({
        key: 'capture',
        label: 'New capture',
        title: newest.title,
        item: {
          itemType: 'document',
          id: newest.sourceId,
          title: newest.title,
          directoryId: newest.directoryId,
        },
      });
    }
    return suggestions;
    // getRecentlyOpened reads MMKV; recompute when the screen becomes active again.
  }, [missedQuery.data, captureItems.data, active]);
}
