import { getFirestore } from 'firebase-admin/firestore';
import {
  LIBRARY_SEARCH_SCHEMA_VERSION,
  LIBRARY_SEARCH_TOMBSTONE_TTL_DAYS,
} from '@shared-types';
import { DocumentService } from '@study-forge/backend-documents/document-storage';
import {
  syncSearchRecord,
  type ISearchRecordTarget,
  type SearchRecordSyncOutcome,
} from './search-record-sync';

/** Brings one item's library search record in step with its source. */
export function syncLibrarySearchRecord(
  target: ISearchRecordTarget,
): Promise<SearchRecordSyncOutcome> {
  return syncSearchRecord(
    {
      db: getFirestore(),
      bucket: DocumentService.getBucket(),
      schemaVersion: LIBRARY_SEARCH_SCHEMA_VERSION,
      tombstoneTtlDays: LIBRARY_SEARCH_TOMBSTONE_TTL_DAYS,
    },
    target,
  );
}
