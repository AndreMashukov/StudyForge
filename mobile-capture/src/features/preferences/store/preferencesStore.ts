import { create } from 'zustand';
import {
  getDefaultDirectoryId,
  hydrateDefaultDirectoryStorage,
  setDefaultDirectoryId as persistDefaultDirectoryId,
} from '../../../lib/storage/defaultDirectoryStorage';

interface IPreferencesState {
  defaultDirectoryId: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setDefaultDirectoryId: (directoryId: string) => void;
}

export const usePreferencesStore = create<IPreferencesState>((set) => ({
  defaultDirectoryId: null,
  hydrated: false,
  hydrate: async () => {
    try {
      await hydrateDefaultDirectoryStorage();
    } catch {
      // Storage read failed — continue with no persisted default directory.
    }
    set({
      defaultDirectoryId: getDefaultDirectoryId(),
      hydrated: true,
    });
  },
  setDefaultDirectoryId: (directoryId) => {
    persistDefaultDirectoryId(directoryId);
    set({ defaultDirectoryId: directoryId });
  },
}));
