import { useEffect } from 'react';
import {
  decrementOpenModalCount,
  incrementOpenModalCount,
} from './modalVisibilityStore';

export function useTrackOpenModal(open: boolean): void {
  useEffect(() => {
    if (!open) {
      return;
    }

    incrementOpenModalCount();
    return () => {
      decrementOpenModalCount();
    };
  }, [open]);
}
