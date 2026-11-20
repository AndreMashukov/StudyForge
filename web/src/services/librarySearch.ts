import './clientDataSetup';
import {
  createLibrarySearchClient,
  type ILibrarySearchClient,
} from '@studyforge/client-data/librarySearch/librarySearchClient';
import { createWebLibrarySearchStore } from './librarySearchStore';

let current: { userId: string; client: ILibrarySearchClient } | null = null;

/** One library search client per signed-in learner, shared by every consumer. */
export function getLibrarySearchClient(userId: string): ILibrarySearchClient {
  if (current?.userId !== userId) {
    current = {
      userId,
      client: createLibrarySearchClient({
        userId,
        store: createWebLibrarySearchStore(),
      }),
    };
  }
  return current.client;
}

/** Removes the learner's search records from this browser. Call on sign-out. */
export async function clearLibrarySearch(): Promise<void> {
  const client = current?.client;
  current = null;
  try {
    await (client?.clear() ?? createWebLibrarySearchStore().clear());
  } catch {
    // Leftover records are replaced on the next learner's first sync.
  }
}
