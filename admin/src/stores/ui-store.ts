import { createStore } from 'zustand/vanilla';
import { createShellSlice, type IShellSlice } from './slices/shell-slice';

export type UiStore = IShellSlice;

export type UiStoreInit = Partial<Pick<UiStore, 'sidebarOpen'>>;

export const createUiStore = (init: UiStoreInit = {}) => {
  return createStore<UiStore>()((...args) => ({
    ...createShellSlice(...args),
    ...init,
  }));
};
