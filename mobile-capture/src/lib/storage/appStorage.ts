import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

interface ISyncStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

type StorageBackend = 'mmkv' | 'async';

let backend: StorageBackend | null = null;
let activeStorage: ISyncStorage | null = null;
let storageInitializing = false;
let mmkvUnavailable = false;
const memoryCache = new Map<string, string>();

interface IMmkvInstance {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCreateMmkvFn(
  value: unknown
): value is (config: { id: string }) => IMmkvInstance {
  return typeof value === 'function';
}

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

function loadCreateMmkv():
  | ((config: { id: string }) => IMmkvInstance)
  | null {
  if (mmkvUnavailable || isExpoGo()) {
    return null;
  }

  try {
    // Dynamic require — nitro-modules throws at module init; skip entirely in Expo Go.
    const moduleExports: unknown = require('react-native-mmkv');
    if (!isRecord(moduleExports) || !isCreateMmkvFn(moduleExports.createMMKV)) {
      mmkvUnavailable = true;
      return null;
    }

    return moduleExports.createMMKV;
  } catch {
    mmkvUnavailable = true;
    return null;
  }
}

function createMmkvStorage(): ISyncStorage | null {
  const createMMKV = loadCreateMmkv();
  if (!createMMKV) {
    return null;
  }

  try {
    const mmkv = createMMKV({ id: 'studyforge-mobile-capture' });
    return {
      getString: (key) => mmkv.getString(key),
      set: (key, value) => {
        mmkv.set(key, value);
      },
      remove: (key) => {
        mmkv.remove(key);
      },
    };
  } catch {
    mmkvUnavailable = true;
    return null;
  }
}

function createAsyncStorageFallback(): ISyncStorage {
  return {
    getString: (key) => memoryCache.get(key),
    set: (key, value) => {
      memoryCache.set(key, value);
      void AsyncStorage.setItem(key, value);
    },
    remove: (key) => {
      memoryCache.delete(key);
      void AsyncStorage.removeItem(key);
    },
  };
}

function initStorage(): StorageBackend {
  if (backend !== null && activeStorage !== null) {
    return backend;
  }

  if (storageInitializing) {
    return backend ?? 'async';
  }

  storageInitializing = true;
  try {
    const mmkv = createMmkvStorage();
    if (mmkv) {
      activeStorage = mmkv;
      backend = 'mmkv';
    } else {
      activeStorage = createAsyncStorageFallback();
      backend = 'async';
    }
    return backend;
  } finally {
    storageInitializing = false;
  }
}

export function isUsingMmkv(): boolean {
  return initStorage() === 'mmkv';
}

/** Load AsyncStorage into memory when MMKV is unavailable (Expo Go). */
export async function hydrateAppStorage(keys: string[]): Promise<void> {
  if (initStorage() === 'mmkv') {
    return;
  }

  const keysToLoad = keys.filter((key) => !memoryCache.has(key));
  if (keysToLoad.length === 0) {
    return;
  }

  try {
    const entries = await AsyncStorage.multiGet(keysToLoad);
    for (const [key, value] of entries) {
      if (value) {
        memoryCache.set(key, value);
      }
    }
  } catch {
    // AsyncStorage unavailable — callers read empty values until a later hydrate succeeds.
  }
}

export function getStorageString(key: string): string | undefined {
  return initStorage() === 'mmkv'
    ? activeStorage?.getString(key)
    : memoryCache.get(key) ?? activeStorage?.getString(key);
}

export function setStorageString(key: string, value: string): void {
  activeStorage?.set(key, value);
}

export function removeStorageString(key: string): void {
  activeStorage?.remove(key);
}
