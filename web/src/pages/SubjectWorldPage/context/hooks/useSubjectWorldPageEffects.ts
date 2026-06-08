import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { SubjectWorldProgressSnapshot, SubjectWorldQuest } from '@shared-types';
import {
  areAllQuestsComplete,
  loadSubjectWorldProgress,
  markWorldCompleted,
  resetSubjectWorldPage,
  selectSubjectWorldPageState,
} from '../../../../store/slices/subjectWorldPageSlice';

export const useSubjectWorldPageEffects = (
  subjectWorldId: string | undefined,
  progress: SubjectWorldProgressSnapshot | null | undefined,
  quests: SubjectWorldQuest[] | undefined
) => {
  const dispatch = useDispatch();
  const pageState = useSelector(selectSubjectWorldPageState);

  useEffect(() => {
    dispatch(resetSubjectWorldPage());
  }, [subjectWorldId, dispatch]);

  useEffect(() => {
    if (progress !== undefined) {
      dispatch(loadSubjectWorldProgress(progress));
    }
  }, [progress, dispatch]);

  useEffect(() => {
    if (!quests?.length || pageState.phase === 'completed') return;
    if (areAllQuestsComplete(quests, pageState.progress)) {
      dispatch(markWorldCompleted());
    }
  }, [dispatch, pageState.phase, pageState.progress, quests]);

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
