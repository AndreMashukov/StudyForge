import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { SubjectWorldProgressSnapshot } from '@shared-types';
import {
  loadSubjectWorldProgress,
  resetSubjectWorldPage,
} from '../../../../store/slices/subjectWorldPageSlice';

export const useSubjectWorldPageEffects = (
  subjectWorldId: string | undefined,
  progress: SubjectWorldProgressSnapshot | null | undefined
) => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(resetSubjectWorldPage());
  }, [subjectWorldId, dispatch]);

  useEffect(() => {
    if (progress !== undefined) {
      dispatch(loadSubjectWorldProgress(progress));
    }
  }, [progress, dispatch]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyE') {
        window.dispatchEvent(new CustomEvent('subject-world-interact'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
