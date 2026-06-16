import {
  getStorageString,
  hydrateAppStorage,
  removeStorageString,
  setStorageString,
} from './appStorage';

const DEFAULT_DIRECTORY_KEY = 'studyforge.mobile.defaultDirectoryId';

export function getDefaultDirectoryId(): string | null {
  const value = getStorageString(DEFAULT_DIRECTORY_KEY);
  return value?.trim() || null;
}

export function setDefaultDirectoryId(directoryId: string): void {
  setStorageString(DEFAULT_DIRECTORY_KEY, directoryId.trim());
}

export function clearDefaultDirectoryId(): void {
  removeStorageString(DEFAULT_DIRECTORY_KEY);
}

export async function hydrateDefaultDirectoryStorage(): Promise<void> {
  await hydrateAppStorage([DEFAULT_DIRECTORY_KEY]);
}
