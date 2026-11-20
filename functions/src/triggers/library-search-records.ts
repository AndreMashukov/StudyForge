import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as functions from 'firebase-functions/v2';
import type { LibrarySearchItemType } from '@shared-types';
import { searchableFieldsChanged } from '@study-forge/backend-directories/library-search/search-record-builders';
import { syncLibrarySearchRecord } from '@study-forge/backend-directories/library-search/search-record-service';
import { sourceCollectionName } from '@study-forge/backend-directories/library-search/search-record-sync';

/**
 * One trigger per library collection keeps `users/{uid}/searchRecords` current
 * for library search. Writes that touch nothing searchable (directory counters,
 * ordering) return before any read.
 */
function createSearchRecordTrigger(itemType: LibrarySearchItemType) {
  return onDocumentWritten(
    {
      document: `users/{userId}/${sourceCollectionName(itemType)}/{sourceId}`,
      region: 'asia-east1',
    },
    async (event) => {
      const { userId, sourceId } = event.params;
      const before = event.data?.before.data();
      const after = event.data?.after.data();

      if (before && after && !searchableFieldsChanged(itemType, before, after)) {
        return;
      }

      try {
        await syncLibrarySearchRecord({ userId, itemType, sourceId });
      } catch (error) {
        functions.logger.error('Library search record sync failed', {
          userId,
          itemType,
          sourceId,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  );
}

export const syncDirectorySearchRecord = createSearchRecordTrigger('directory');
export const syncDocumentSearchRecord = createSearchRecordTrigger('document');
export const syncQuizSearchRecord = createSearchRecordTrigger('quiz');
export const syncFlashcardSetSearchRecord =
  createSearchRecordTrigger('flashcard');
export const syncSlideDeckSearchRecord = createSearchRecordTrigger('slideDeck');
export const syncDiagramQuizSearchRecord =
  createSearchRecordTrigger('diagramQuiz');
export const syncSequenceQuizSearchRecord =
  createSearchRecordTrigger('sequenceQuiz');
export const syncMatchQuizSearchRecord = createSearchRecordTrigger('matchQuiz');
