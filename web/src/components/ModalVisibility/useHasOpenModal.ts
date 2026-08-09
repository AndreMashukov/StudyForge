import { useSyncExternalStore } from 'react';
import {
  getHasOpenModalSnapshot,
  subscribeOpenModalCount,
} from './modalVisibilityStore';

export function useHasOpenModal(): boolean {
  return useSyncExternalStore(
    subscribeOpenModalCount,
    getHasOpenModalSnapshot,
    getHasOpenModalSnapshot,
  );
}
