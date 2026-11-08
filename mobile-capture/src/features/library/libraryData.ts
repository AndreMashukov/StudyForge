import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDocFromServer, getDocsFromServer, onSnapshot, orderBy, query } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import type { DirectoryItemSummary } from '@shared-types';
import { z } from 'zod';
import { db, storage } from '../../lib/firebase';
import { queryKeys } from '../../lib/api/queryKeys';
import { buildDirectoryTreeFromDirectories, toDirectory } from '../../lib/api/directoryTreeFirestore';

const itemSchema = z.object({
  id: z.string(), sourceId: z.string(), directoryId: z.string(), title: z.string(),
  itemType: z.enum(['subdirectory', 'document', 'quiz', 'flashcard', 'slideDeck', 'diagramQuiz', 'sequenceQuiz', 'matchQuiz']),
  createdAt: z.custom<DirectoryItemSummary['createdAt']>((value) => value != null),
  sortOrder: z.number().optional(), generationStatus: z.enum(['pending', 'completed', 'failed']).optional(),
  generationError: z.string().optional(),
});

export function parseDirectoryItems(docs: Array<{ id: string; data: () => unknown }>): DirectoryItemSummary[] {
  return docs.flatMap((item) => {
    const raw = item.data();
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [];
    const result = itemSchema.safeParse({ ...raw, id: item.id });
    return result.success ? [result.data] : [];
  });
}

export function subscribeDirectoryItems(
  userId: string,
  directoryId: string,
  onItems: (items: DirectoryItemSummary[]) => void,
  onError: (error: Error) => void,
) {
  let active = true;
  const unsubscribe = onSnapshot(collection(db, 'users', userId, 'directories', directoryId, 'items'), { includeMetadataChanges: true },
    (snapshot) => { if (active && !snapshot.metadata.fromCache) onItems(parseDirectoryItems(snapshot.docs)); },
    (error) => { if (active) onError(error); });
  return () => { active = false; unsubscribe(); };
}

export function useLiveDirectoryTree(userId: string | undefined, active: boolean) {
  const client = useQueryClient();
  const [error, setError] = useState<Error | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!userId || !active) return;
    setError(null);
    let listening = true;
    const unsubscribe = onSnapshot(query(collection(db, 'users', userId, 'directories'), orderBy('path', 'asc')), { includeMetadataChanges: true }, (snapshot) => {
      if (!listening || snapshot.metadata.fromCache) return;
      const directories = snapshot.docs.flatMap((item) => {
        const parsed = toDirectory(item.id, item.data());
        return parsed ? [parsed] : [];
      });
      client.setQueryData(queryKeys.directoryTree(userId), {
        tree: buildDirectoryTreeFromDirectories(directories), totalDirectories: directories.length,
      });
      setError(null);
    }, (snapshotError) => { if (listening) setError(snapshotError); });
    return () => { listening = false; unsubscribe(); };
  }, [userId, active, client, revision]);
  return { error: active ? error : null, retry: () => setRevision((value) => value + 1) };
}

export function useDirectoryItems(userId: string | undefined, directoryId: string | null, active: boolean) {
  const client = useQueryClient();
  const [liveError, setLiveError] = useState<Error | null>(null);
  const [revision, setRevision] = useState(0);
  const key = queryKeys.directoryItems(userId ?? '', directoryId ?? '');
  const result = useQuery({
    queryKey: key,
    enabled: Boolean(userId && directoryId && active),
    queryFn: async () => {
      if (!userId || !directoryId) throw new Error('Directory unavailable');
      const snapshot = await getDocsFromServer(collection(db, 'users', userId, 'directories', directoryId, 'items'));
      return parseDirectoryItems(snapshot.docs);
    },
  });
  useEffect(() => {
    if (!userId || !directoryId || !active) return;
    setLiveError(null);
    return subscribeDirectoryItems(userId, directoryId, (items) => {
      client.setQueryData(queryKeys.directoryItems(userId, directoryId), items);
      setLiveError(null);
    }, (error) => setLiveError(error));
  }, [userId, directoryId, active, client, revision]);
  return { ...result, liveError: active && directoryId ? liveError : null, retryLive: () => setRevision((value) => value + 1) };
}

export interface ILibraryDocument {
  id: string;
  title: string;
  directoryId: string;
  storagePath?: string;
  contentFormat?: 'html' | 'markdown';
  generationStatus?: 'pending' | 'completed' | 'failed';
  generationError?: string;
  updatedAt?: unknown;
}

const documentSchema = z.object({
  title: z.string(), directoryId: z.string(), storagePath: z.string().optional(),
  contentFormat: z.enum(['html', 'markdown']).optional(),
  generationStatus: z.enum(['pending', 'completed', 'failed']).optional(), generationError: z.string().optional(), updatedAt: z.unknown().optional(),
});

export function useLibraryDocument(userId: string | undefined, documentId: string | undefined) {
  const client = useQueryClient();
  const [liveError, setLiveError] = useState<Error | null>(null);
  const [revision, setRevision] = useState(0);
  const result = useQuery({
    queryKey: queryKeys.document(userId ?? '', documentId ?? ''),
    enabled: Boolean(userId && documentId),
    queryFn: async (): Promise<ILibraryDocument | null> => {
      if (!userId || !documentId) throw new Error('Document unavailable');
      const snapshot = await getDocFromServer(doc(db, 'users', userId, 'documents', documentId));
      return snapshot.exists() ? { ...documentSchema.parse(snapshot.data()), id: snapshot.id } : null;
    },
  });
  useEffect(() => {
    if (!userId || !documentId) return;
    setLiveError(null);
    let listening = true;
    const unsubscribe = onSnapshot(doc(db, 'users', userId, 'documents', documentId), { includeMetadataChanges: true }, (snapshot) => {
      if (!listening || snapshot.metadata.fromCache) return;
      try {
        const value = snapshot.exists() ? { ...documentSchema.parse(snapshot.data()), id: snapshot.id } : null;
        client.setQueryData(queryKeys.document(userId, documentId), value);
        setLiveError(null);
      } catch (error) {
        setLiveError(error instanceof Error ? error : new Error('Invalid document'));
      }
    }, (error) => { if (listening) setLiveError(error); });
    return () => { listening = false; unsubscribe(); };
  }, [userId, documentId, client, revision]);
  return { ...result, liveError, retryLive: () => setRevision((value) => value + 1) };
}

export async function fetchDocumentContent(userId: string, document: ILibraryDocument): Promise<{ content: string; format: 'html' | 'markdown' }> {
  const base = `users/${userId}/documents/${document.id}`;
  const candidates = document.storagePath
    ? [{ path: document.storagePath, format: document.contentFormat ?? (document.storagePath.endsWith('.md') ? 'markdown' : 'html') }]
    : document.contentFormat
      ? [{ path: `${base}/content.${document.contentFormat === 'html' ? 'html' : 'md'}`, format: document.contentFormat }]
      : [{ path: `${base}/content.html`, format: 'html' as const }, { path: `${base}/content.md`, format: 'markdown' as const }];
  for (const candidate of candidates) {
    if (!candidate.path.startsWith(`${base}/`)) throw new Error('Invalid document storage path');
    try {
      const url = await getDownloadURL(ref(storage, candidate.path));
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Unable to load document (${response.status})`);
      return { content: await response.text(), format: candidate.format };
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'storage/object-not-found' && candidate !== candidates[candidates.length - 1]) continue;
      throw error;
    }
  }
  throw new Error('Document content not found');
}
