import { z } from 'zod';
import {
  getStorageString,
  hydrateAppStorage,
  setStorageString,
} from './appStorage';

const STORAGE_KEY = 'studyforge.mobile.recentlyOpened.v1';
/** Offline keeps roughly this many recently opened documents and study sets. */
export const RECENTLY_OPENED_LIMIT = 20;

const recentItemSchema = z.object({
  itemType: z.string(),
  id: z.string(),
  title: z.string(),
  directoryId: z.string().optional(),
  openedAt: z.string(),
});

export type IRecentlyOpenedItem = z.infer<typeof recentItemSchema>;

export function hydrateRecentlyOpened(): Promise<void> {
  return hydrateAppStorage([STORAGE_KEY]);
}

export function getRecentlyOpened(): IRecentlyOpenedItem[] {
  const raw = getStorageString(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = z.array(recentItemSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function getRecentlyOpenedIds(): Set<string> {
  return new Set(getRecentlyOpened().map((item) => item.id));
}

/** Most recent first, deduplicated by id, capped at RECENTLY_OPENED_LIMIT. */
export function mergeRecentlyOpened(
  existing: IRecentlyOpenedItem[],
  next: IRecentlyOpenedItem,
): IRecentlyOpenedItem[] {
  return [next, ...existing.filter((item) => item.id !== next.id)].slice(
    0,
    RECENTLY_OPENED_LIMIT,
  );
}

export function recordRecentlyOpened(
  item: Omit<IRecentlyOpenedItem, 'openedAt'>,
): void {
  const next = mergeRecentlyOpened(getRecentlyOpened(), {
    ...item,
    openedAt: new Date().toISOString(),
  });
  setStorageString(STORAGE_KEY, JSON.stringify(next));
}
