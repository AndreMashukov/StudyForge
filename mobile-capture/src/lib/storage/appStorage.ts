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
let hydrationPromise: Promise<void> | null = null;
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const moduleExports: unknown = require('react-native-mmkv');
    if (!isRecord(moduleExports) || typeof moduleExports.createMMKV !== 'function') {
      mmkvUnavailable = true;
      return null;
    }

    return moduleExports.createMMKV as (config: { id: string }) => IMmkvInstance;
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
  if (backend && activeStorage) {
    return backend;
  }

  const mmkv = createMmkvStorage();
  if (mmkv) {
    activeStorage = mmkv;
    backend = 'mmkv';
  } else {
    activeStorage = createAsyncStorageFallback();
    backend = 'async';
  }

  return backend;
}

export function isUsingMmkv(): boolean {
  return initStorage() === 'mmkv';
}

/** Load AsyncStorage into memory when MMKV is unavailable (Expo Go). */
export async function hydrateAppStorage(keys: string[]): Promise<void> {
  if (initStorage() === 'mmkv') {
    return;
  }

  if (!hydrationPromise) {
    hydrationPromise = (async () => {
      const entries = await AsyncStorage.multiGet(keys);
      for (const [key, value] of entries) {
        if (value) {
          memoryCache.set(key, value);
        }
      }
    })();
  }

  await hydrationPromise;
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
