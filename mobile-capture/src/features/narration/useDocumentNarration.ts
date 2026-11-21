import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NarrationQuote, NarrationRecord } from '@shared-types';
import {
  evaluateDocumentNarratability,
  getCallableErrorMessage,
  isNarrationPriceChangedError,
  quoteDocumentNarration,
  removeDocumentNarration,
  startDocumentNarration,
} from '../../lib/api/studyforgeApi';
import type { ILibraryDocument } from '../library/libraryData';
import {
  clearCachedNarration,
  pruneCachedNarration,
} from './narrationAudioCache';
import { useNarrationRecord } from './useNarrationRecord';

export interface IDocumentNarration {
  /** Server-side check result, or `checking` while an unjudged document is being judged. */
  check: 'checking' | 'narratable' | 'notNarratable' | 'tooLong' | 'unknown';
  record: NarrationRecord | null | undefined;
  quote: NarrationQuote | undefined;
  quoteLoading: boolean;
  starting: boolean;
  removing: boolean;
  message: string | null;
  start: () => Promise<void>;
  remove: () => Promise<boolean>;
}

/**
 * Everything the reader needs to offer narration for one document: the
 * narratable check (run on open for unjudged documents), the live narration,
 * the price of what is missing, and the start and remove actions.
 */
export function useDocumentNarration(
  userId: string | undefined,
  document: ILibraryDocument | null | undefined,
  documentReady: boolean,
  online: boolean,
): IDocumentNarration {
  const client = useQueryClient();
  const documentId = document?.id;
  const { record } = useNarrationRecord(userId, documentId);
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const evaluatedRef = useRef<string | null>(null);

  const narratability = document?.narratability;

  // Documents judged before narration existed (or whose check failed) are judged on open.
  useEffect(() => {
    if (!documentId || !documentReady || !online || narratability) return;
    if (evaluatedRef.current === documentId) return;
    evaluatedRef.current = documentId;
    setChecking(true);
    setCheckFailed(false);
    evaluateDocumentNarratability(documentId)
      .then((result) => setCheckFailed(!result.narratability))
      .catch(() => setCheckFailed(true))
      .finally(() => setChecking(false));
  }, [documentId, documentReady, online, narratability]);

  const narratable = narratability?.status === 'narratable';
  const generating = record?.status === 'generating';
  const readyParts =
    record?.parts.filter((part) => part.status === 'ready').length ?? 0;
  const failedParts =
    record?.parts.filter((part) => part.status === 'failed').length ?? 0;
  // No price is needed while parts are being generated; refetch once the run ends.
  const quoteQuery = useQuery({
    queryKey: [
      'narrationQuote',
      userId ?? '',
      documentId ?? '',
      narratability?.contentHash ?? '',
      record?.status ?? 'none',
      readyParts,
      failedParts,
    ],
    enabled: Boolean(
      userId && documentId && narratable && online && !generating,
    ),
    queryFn: async () => {
      if (!documentId) throw new Error('Document unavailable');
      return (await quoteDocumentNarration(documentId)).quote;
    },
  });

  // Keep the device cache to the parts the narration still has.
  useEffect(() => {
    if (!documentId || record === undefined) return;
    if (record === null) return;
    try {
      pruneCachedNarration(
        documentId,
        record.parts.map((part) => part.key),
      );
    } catch {
      // Cache cleanup is best effort.
    }
  }, [documentId, record]);

  const start = async () => {
    const quote = quoteQuery.data;
    if (!documentId || !quote?.available) return;
    setStarting(true);
    setMessage(null);
    try {
      const result = await startDocumentNarration({
        documentId,
        expectedCredits: quote.credits,
      });
      if (result.status === 'alreadyRunning')
        setMessage('This narration is already being prepared.');
    } catch (error) {
      if (isNarrationPriceChangedError(error)) {
        setMessage('The price changed. Check the new price and try again.');
      } else {
        setMessage(getCallableErrorMessage(error));
      }
    } finally {
      setStarting(false);
      await client.invalidateQueries({
        queryKey: ['narrationQuote', userId ?? '', documentId],
      });
    }
  };

  const remove = async (): Promise<boolean> => {
    if (!documentId) return false;
    setRemoving(true);
    setMessage(null);
    try {
      await removeDocumentNarration(documentId);
      try {
        clearCachedNarration(documentId);
      } catch {
        // Cache cleanup is best effort.
      }
      return true;
    } catch (error) {
      setMessage(getCallableErrorMessage(error));
      return false;
    } finally {
      setRemoving(false);
      await client.invalidateQueries({
        queryKey: ['narrationQuote', userId ?? '', documentId],
      });
    }
  };

  const check: IDocumentNarration['check'] = narratability
    ? narratability.status === 'narratable'
      ? 'narratable'
      : narratability.reason === 'tooLong'
        ? 'tooLong'
        : 'notNarratable'
    : checking
      ? 'checking'
      : checkFailed || !online
        ? 'unknown'
        : 'checking';

  return {
    check,
    record,
    quote: quoteQuery.data,
    quoteLoading: quoteQuery.isLoading,
    starting,
    removing,
    message,
    start,
    remove,
  };
}
