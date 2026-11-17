import { create } from 'zustand';

interface IShellState {
  /** Non-null while the capture sheet is open; directoryId is the screen's directory, if any. */
  capture: { directoryId: string | null } | null;
  newDirectory: { parentId: string | null; parentName?: string } | null;
  openCapture: (directoryId?: string | null) => void;
  closeCapture: () => void;
  openNewDirectory: (parentId?: string | null, parentName?: string) => void;
  closeNewDirectory: () => void;
}

export const useShellStore = create<IShellState>((set) => ({
  capture: null,
  newDirectory: null,
  openCapture: (directoryId = null) => set({ capture: { directoryId } }),
  closeCapture: () => set({ capture: null }),
  openNewDirectory: (parentId = null, parentName) =>
    set({ newDirectory: { parentId, parentName } }),
  closeNewDirectory: () => set({ newDirectory: null }),
}));
