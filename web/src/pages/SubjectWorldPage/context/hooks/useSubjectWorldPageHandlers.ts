import { useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { SubjectWorld } from '@shared-types';
import {
  closeGate,
  closePoi,
  completeQuest,
  isQuestComplete,
  openGate,
  openPoi,
  selectGateAnswer,
  selectSubjectWorldPageState,
  unlockGate,
} from '../../../../store/slices/subjectWorldPageSlice';
import { useSaveSubjectWorldProgressMutation } from '../../../../store/api/SubjectWorld/SubjectWorldApi';
import { ISceneMarker } from '../../utils/subjectWorldSceneAdapter';
import { ISubjectWorldPageHandlers } from '../../types/ISubjectWorldPageHandlers';

export const useSubjectWorldPageHandlers = (
  subjectWorld: SubjectWorld | null | undefined
): ISubjectWorldPageHandlers => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const pageState = useSelector(selectSubjectWorldPageState);
  const nearMarkerRef = useRef<ISceneMarker | null>(null);
  const [saveProgress] = useSaveSubjectWorldProgressMutation();

  const persistProgress = useCallback(() => {
    if (!subjectWorld?.id) return;
    saveProgress({
      subjectWorldId: subjectWorld.id,
      progress: pageState.progress,
    });
  }, [saveProgress, subjectWorld?.id, pageState.progress]);

  const handleBackToDirectory = useCallback(() => {
    const directoryId =
      subjectWorld?.directoryId?.trim() ||
      searchParams.get('directoryId')?.trim() ||
      null;
    if (directoryId) {
      navigate(`/directory/${directoryId}?tab=subjectWorlds`);
    } else {
      navigate('/');
    }
  }, [navigate, searchParams, subjectWorld?.directoryId]);

  const handleNearMarkerChange = useCallback((marker: ISceneMarker | null) => {
    nearMarkerRef.current = marker;
  }, []);

  const handleInteract = useCallback(() => {
    const marker = nearMarkerRef.current;
    if (!marker || !subjectWorld?.worldSpec) return;

    if (marker.kind === 'poi') {
      const poi = subjectWorld.worldSpec.pois.find((p) => p.id === marker.id);
      if (poi) {
        dispatch(openPoi(poi));
        persistProgress();
      }
      return;
    }

    const gate = subjectWorld.worldSpec.gates.find((g) => g.id === marker.id);
    if (gate && !pageState.progress.unlockedGateIds.includes(gate.id)) {
      dispatch(openGate(gate));
    }
  }, [dispatch, pageState.progress.unlockedGateIds, persistProgress, subjectWorld?.worldSpec]);

  const handleClosePanel = useCallback(() => {
    dispatch(closePoi());
    dispatch(closeGate());
  }, [dispatch]);

  const handleSelectGateAnswer = useCallback(
    (index: number) => {
      dispatch(selectGateAnswer(index));
    },
    [dispatch]
  );

  const handleSubmitGateAnswer = useCallback(() => {
    const gate = pageState.activeGate;
    if (!gate || pageState.selectedGateAnswer === null || !subjectWorld?.worldSpec) return;

    if (pageState.selectedGateAnswer === gate.correctAnswer) {
      dispatch(unlockGate(gate.id));
      subjectWorld.worldSpec.quests.forEach((quest) => {
        if (isQuestComplete(quest, {
          ...pageState.progress,
          unlockedGateIds: [...pageState.progress.unlockedGateIds, gate.id],
        })) {
          dispatch(completeQuest(quest.id));
        }
      });
      persistProgress();
    }
  }, [dispatch, pageState.activeGate, pageState.progress, pageState.selectedGateAnswer, persistProgress, subjectWorld?.worldSpec]);

  return {
    handleBackToDirectory,
    handleNearMarkerChange,
    handleInteract,
    handleClosePanel,
    handleSelectGateAnswer,
    handleSubmitGateAnswer,
  };
};
