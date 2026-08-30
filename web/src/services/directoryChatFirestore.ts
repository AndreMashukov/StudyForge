import {
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import type {
  DirectoryChatMessage,
  DirectoryChatSourceSummary,
  GetDirectoryChatResponse,
  UpdateDirectoryChatSourcesResponse,
} from '@shared-types';
import { computeExpiresAt } from './firestoreTtl';
import { fetchDirectoryFromFirestore } from './directoryFirestore';
import {
  directoryChatMessagesCollection,
  directoryChatThreadRef,
} from './firestorePaths';
import { fetchDirectoryItemsFromFirestore } from './directoryItemIndex';
import {
  fetchAllUserDocsPaginated,
  FIRESTORE_DOCUMENTS_LIST_LIMIT,
  whereEquals,
} from './firestoreReadUtils';

const MAX_MESSAGES_RETURNED = 200;

interface IDirectoryChatSourceState {
  sources: DirectoryChatSourceSummary[];
  selectedDocumentIds: string[];
  documentCount: number;
}

function extractSummary(
  threadData: Record<string, unknown> | undefined,
): string | undefined {
  const summary = threadData?.summary;
  return typeof summary === 'string' && summary.trim() ? summary : undefined;
}

function extractSelectedDocumentIds(
  threadData: Record<string, unknown> | undefined,
): string[] | undefined {
  const selectedDocumentIds = threadData?.selectedDocumentIds;
  if (!Array.isArray(selectedDocumentIds)) {
    return undefined;
  }
  return selectedDocumentIds.filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
}

function normalizeSelectedDocumentIds(
  storedSelectedDocumentIds: string[] | undefined,
  allDocumentIds: string[],
): string[] {
  if (allDocumentIds.length === 0) {
    return [];
  }
  if (!storedSelectedDocumentIds || storedSelectedDocumentIds.length === 0) {
    return [...allDocumentIds];
  }
  const availableIds = new Set(allDocumentIds);
  const validSelectedIds = storedSelectedDocumentIds.filter((id) =>
    availableIds.has(id),
  );
  return validSelectedIds.length > 0 ? validSelectedIds : [...allDocumentIds];
}

async function listDirectoryDocumentSources(
  userId: string,
  directoryId: string,
): Promise<DirectoryChatSourceSummary[]> {
  const items = await fetchDirectoryItemsFromFirestore(userId, directoryId);
  const fromItems = items
    .filter((item) => item.itemType === 'document')
    .map((item) => ({
      id: item.sourceId,
      title: item.title.trim() ? item.title.trim() : 'Untitled',
    }));

  if (fromItems.length > 0) {
    return fromItems;
  }

  const documentSnaps = await fetchAllUserDocsPaginated(
    userId,
    'documents',
    [whereEquals('directoryId', directoryId)],
    FIRESTORE_DOCUMENTS_LIST_LIMIT,
  );

  return documentSnaps.map((docSnap) => {
    const data = docSnap.data();
    const title =
      typeof data.title === 'string' && data.title.trim()
        ? data.title.trim()
        : 'Untitled';
    return { id: docSnap.id, title };
  });
}

async function resolveSourceState(
  userId: string,
  directoryId: string,
  threadData?: Record<string, unknown>,
): Promise<IDirectoryChatSourceState> {
  const sources = await listDirectoryDocumentSources(userId, directoryId);

  const allDocumentIds = sources.map((source) => source.id);
  let storedSelectedDocumentIds: string[] | undefined;
  if (threadData === undefined) {
    const threadSnapshot = await getDoc(
      directoryChatThreadRef(userId, directoryId),
    );
    storedSelectedDocumentIds = extractSelectedDocumentIds(
      threadSnapshot.exists() ? threadSnapshot.data() : undefined,
    );
  } else {
    storedSelectedDocumentIds = extractSelectedDocumentIds(threadData);
  }

  const selectedDocumentIds = normalizeSelectedDocumentIds(
    storedSelectedDocumentIds,
    allDocumentIds,
  );

  const shouldPersistSelection =
    allDocumentIds.length > 0 &&
    (storedSelectedDocumentIds === undefined ||
      storedSelectedDocumentIds.length === 0 ||
      selectedDocumentIds.length !== storedSelectedDocumentIds.length ||
      selectedDocumentIds.some(
        (id, index) => id !== storedSelectedDocumentIds?.[index],
      ));

  if (shouldPersistSelection) {
    await persistSelectedDocumentIds(userId, directoryId, selectedDocumentIds);
  }

  return {
    sources,
    selectedDocumentIds,
    documentCount: sources.length,
  };
}

async function persistSelectedDocumentIds(
  userId: string,
  directoryId: string,
  selectedDocumentIds: string[],
): Promise<void> {
  const threadUpdatedAt = new Date();
  await setDoc(
    directoryChatThreadRef(userId, directoryId),
    {
      directoryId,
      selectedDocumentIds,
      updatedAt: serverTimestamp(),
      expiresAt: computeExpiresAt(threadUpdatedAt, 'directoryChat'),
    },
    { merge: true },
  );
}

async function getMessages(
  userId: string,
  directoryId: string,
): Promise<DirectoryChatMessage[]> {
  const snapshot = await getDocs(
    query(
      directoryChatMessagesCollection(userId, directoryId),
      orderBy('createdAt', 'asc'),
      limit(MAX_MESSAGES_RETURNED),
    ),
  );

  return snapshot.docs.flatMap((messageDoc) => {
    const data = messageDoc.data();
    const role =
      data.role === 'user' || data.role === 'assistant' ? data.role : null;
    if (!role || typeof data.content !== 'string') {
      return [];
    }

    const createdAt =
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : typeof data.createdAt === 'string'
          ? data.createdAt
          : new Date().toISOString();

    return [
      {
        id: messageDoc.id,
        role,
        content: data.content,
        createdAt,
        ...(typeof data.seedKey === 'string' ? { seedKey: data.seedKey } : {}),
      },
    ];
  });
}

export async function getDirectoryChatFromFirestore(
  userId: string,
  directoryId: string,
): Promise<GetDirectoryChatResponse> {
  const directory = await fetchDirectoryFromFirestore(userId, directoryId);
  if (!directory) {
    throw new Error('Directory not found');
  }

  const [messages, threadSnapshot] = await Promise.all([
    getMessages(userId, directoryId),
    getDoc(directoryChatThreadRef(userId, directoryId)),
  ]);

  const threadData = threadSnapshot.exists()
    ? threadSnapshot.data()
    : undefined;
  const summary = extractSummary(threadData);
  const sourceState = await resolveSourceState(userId, directoryId, threadData);

  return {
    directoryId,
    documentCount: sourceState.documentCount,
    selectedDocumentIds: sourceState.selectedDocumentIds,
    sources: sourceState.sources,
    messages,
    ...(summary ? { summary } : {}),
  };
}

export async function updateDirectoryChatSourcesInFirestore(
  userId: string,
  directoryId: string,
  selectedDocumentIds: string[],
): Promise<UpdateDirectoryChatSourcesResponse> {
  const directory = await fetchDirectoryFromFirestore(userId, directoryId);
  if (!directory) {
    throw new Error('Directory not found');
  }

  if (!Array.isArray(selectedDocumentIds) || selectedDocumentIds.length === 0) {
    throw new Error('Select at least one source for chat.');
  }

  const sourceState = await resolveSourceState(userId, directoryId);
  const availableIds = new Set(sourceState.sources.map((source) => source.id));
  const invalidIds = selectedDocumentIds.filter((id) => !availableIds.has(id));

  if (invalidIds.length > 0) {
    throw new Error(
      'One or more selected sources are not available in this directory.',
    );
  }

  await persistSelectedDocumentIds(userId, directoryId, selectedDocumentIds);

  return {
    directoryId,
    documentCount: sourceState.documentCount,
    selectedDocumentIds,
    sources: sourceState.sources,
  };
}
