import { create } from 'zustand';
import {
  getDefaultDirectoryId,
  hydrateDefaultDirectoryStorage,
  setDefaultDirectoryId as persistDefaultDirectoryId,
} from '../../../lib/storage/defaultDirectoryStorage';
import {
  DEFAULT_READER_TEXT_SCALE,
  getReaderTextScale,
  hydrateReaderTextScaleStorage,
  setReaderTextScale as persistReaderTextScale,
  type ReaderTextScale,
} from '../../../lib/storage/readerTextScaleStorage';

interface IPreferencesState {
  defaultDirectoryId: string | null;
  readerTextScale: ReaderTextScale;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setDefaultDirectoryId: (directoryId: string) => void;
  setReaderTextScale: (scale: ReaderTextScale) => void;
}

export const usePreferencesStore = create<IPreferencesState>((set) => ({
  defaultDirectoryId: null,
  readerTextScale: DEFAULT_READER_TEXT_SCALE,
  hydrated: false,
  hydrate: async () => {
    try {
      await Promise.all([
        hydrateDefaultDirectoryStorage(),
        hydrateReaderTextScaleStorage(),
      ]);
    } catch {
      // Storage read failed — continue with defaults for anything not loaded.
    }
    set({
      defaultDirectoryId: getDefaultDirectoryId(),
      readerTextScale: getReaderTextScale(),
      hydrated: true,
    });
  },
  setDefaultDirectoryId: (directoryId) => {
    persistDefaultDirectoryId(directoryId);
    set({ defaultDirectoryId: directoryId });
  },
  setReaderTextScale: (scale) => {
    persistReaderTextScale(scale);
    set({ readerTextScale: scale });
  },
}));
