import type { StateCreator } from 'zustand';
import type { UiStore } from '../ui-store';

export interface IShellSlice {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const createShellSlice: StateCreator<UiStore, [], [], IShellSlice> = (set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
});
