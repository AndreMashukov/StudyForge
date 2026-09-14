import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
  IDirectoryChatPendingSeed,
  setPendingDirectoryChatSeed,
} from '../store/slices/directoryChatSlice';

export const usePublishDirectoryChatQuizSeed = (
  seed: IDirectoryChatPendingSeed | null,
): void => {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!seed) {
      return;
    }

    dispatch(setPendingDirectoryChatSeed(seed));
  }, [dispatch, seed]);
};
