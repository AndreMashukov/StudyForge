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
import {
  DEFAULT_NARRATION_RATE,
  getNarrationLoop,
  getNarrationRate,
  hydrateNarrationStorage,
  setNarrationLoop as persistNarrationLoop,
  setNarrationRate as persistNarrationRate,
} from '../../../lib/storage/narrationStorage';
import type { NarrationPlaybackRate } from '@shared-types';

interface IPreferencesState {
  defaultDirectoryId: string | null;
  readerTextScale: ReaderTextScale;
  /** Narration rate and loop apply to every document on this device. */
  narrationRate: NarrationPlaybackRate;
  narrationLoop: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setDefaultDirectoryId: (directoryId: string) => void;
  setReaderTextScale: (scale: ReaderTextScale) => void;
  setNarrationRate: (rate: NarrationPlaybackRate) => void;
  setNarrationLoop: (loop: boolean) => void;
}

export const usePreferencesStore = create<IPreferencesState>((set) => ({
  defaultDirectoryId: null,
  readerTextScale: DEFAULT_READER_TEXT_SCALE,
  narrationRate: DEFAULT_NARRATION_RATE,
  narrationLoop: false,
  hydrated: false,
  hydrate: async () => {
    try {
      await Promise.all([
        hydrateDefaultDirectoryStorage(),
        hydrateReaderTextScaleStorage(),
        hydrateNarrationStorage(),
      ]);
    } catch {
      // Storage read failed — continue with defaults for anything not loaded.
    }
    set({
      defaultDirectoryId: getDefaultDirectoryId(),
      readerTextScale: getReaderTextScale(),
      narrationRate: getNarrationRate(),
      narrationLoop: getNarrationLoop(),
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
  setNarrationRate: (rate) => {
    persistNarrationRate(rate);
    set({ narrationRate: rate });
  },
  setNarrationLoop: (loop) => {
    persistNarrationLoop(loop);
    set({ narrationLoop: loop });
  },
}));
