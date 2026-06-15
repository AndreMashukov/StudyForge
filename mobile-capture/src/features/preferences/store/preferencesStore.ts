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
    await hydrateDefaultDirectoryStorage();
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
