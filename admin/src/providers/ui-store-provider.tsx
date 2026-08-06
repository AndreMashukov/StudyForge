'use client';

import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createUiStore, type UiStore, type UiStoreInit } from '@admin/stores/ui-store';

export type UiStoreApi = ReturnType<typeof createUiStore>;

const UiStoreContext = createContext<UiStoreApi | undefined>(undefined);

export interface IUiStoreProviderProps {
  children: ReactNode;
  initialState?: UiStoreInit;
}

export function UiStoreProvider({ children, initialState }: IUiStoreProviderProps) {
  const storeRef = useRef<UiStoreApi | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createUiStore(initialState);
  }

  return (
    <UiStoreContext.Provider value={storeRef.current}>{children}</UiStoreContext.Provider>
  );
}

export function useUiStore<T>(selector: (state: UiStore) => T): T {
  const store = useContext(UiStoreContext);
  if (!store) {
    throw new Error('useUiStore must be used within UiStoreProvider');
  }
  return useStore(store, selector);
}
