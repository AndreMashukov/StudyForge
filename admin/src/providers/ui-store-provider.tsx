'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createUiStore, type UiStore, type UiStoreInit } from '@admin/stores/ui-store';

export type UiStoreApi = ReturnType<typeof createUiStore>;

const UiStoreContext = createContext<UiStoreApi | undefined>(undefined);

export function UiStoreProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: UiStoreInit;
}) {
  const [store] = useState(() => createUiStore(initialState));

  return <UiStoreContext.Provider value={store}>{children}</UiStoreContext.Provider>;
}

export function useUiStore<T>(selector: (state: UiStore) => T): T {
  const store = useContext(UiStoreContext);
  if (!store) {
    throw new Error('useUiStore must be used within UiStoreProvider');
  }
  return useStore(store, selector);
}
