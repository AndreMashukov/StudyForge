import { useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { SubjectWorld, SubjectWorldProgressSnapshot } from '@shared-types';
import {
  areAllQuestsComplete,
  closeGate,
  closePoi,
  completeQuest,
  isQuestComplete,
  markWorldCompleted,
  openGate,
  openPoi,
  selectGateAnswer,
  selectSubjectWorldPageState,
  setGateAnswerWrong,
  unlockGate,
} from '../../../../store/slices/subjectWorldPageSlice';
import { useSaveSubjectWorldProgressMutation } from '../../../../store/api/SubjectWorld/SubjectWorldApi';
import { ISceneMarker } from '../../utils/subjectWorldSceneAdapter';
import { ISubjectWorldPageHandlers } from '../../types/ISubjectWorldPageHandlers';

function applyQuestCompletions(
  dispatch: ReturnType<typeof useDispatch>,
  progress: SubjectWorldProgressSnapshot,
  quests: SubjectWorld['worldSpec']['quests']
): SubjectWorldProgressSnapshot {
  let nextProgress = progress;
  quests.forEach((quest) => {
    if (isQuestComplete(quest, nextProgress) && !nextProgress.completedQuestIds.includes(quest.id)) {
      dispatch(completeQuest(quest.id));
      nextProgress = {
        ...nextProgress,
        completedQuestIds: [...nextProgress.completedQuestIds, quest.id],
      };
    }
  });
  return nextProgress;
}

export const useSubjectWorldPageHandlers = (
  subjectWorld: SubjectWorld | null | undefined
): ISubjectWorldPageHandlers => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const pageState = useSelector(selectSubjectWorldPageState);
  const nearMarkerRef = useRef<ISceneMarker | null>(null);
  const [saveProgress] = useSaveSubjectWorldProgressMutation();

  const persistProgress = useCallback(
    (progress: SubjectWorldProgressSnapshot) => {
      if (!subjectWorld?.id) return;
      saveProgress({
        subjectWorldId: subjectWorld.id,
        progress,
      });
    },
    [saveProgress, subjectWorld?.id]
  );

  const maybeMarkWorldComplete = useCallback(
    (progress: SubjectWorldProgressSnapshot) => {
      if (!subjectWorld?.worldSpec.quests.length) return progress;
      if (pageState.phase === 'completed') return progress;

      if (areAllQuestsComplete(subjectWorld.worldSpec.quests, progress)) {
        dispatch(markWorldCompleted());
      }
      return progress;
    },
    [dispatch, pageState.phase, subjectWorld?.worldSpec.quests]
  );

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

  const interactWithMarker = useCallback(
    (marker: ISceneMarker) => {
      if (!subjectWorld?.worldSpec) return;

      if (marker.kind === 'poi') {
        const poi = subjectWorld.worldSpec.pois.find((p) => p.id === marker.id);
        if (!poi) return;

        dispatch(openPoi(poi));
        let nextProgress: SubjectWorldProgressSnapshot = { ...pageState.progress };
        if (!nextProgress.visitedPoiIds.includes(poi.id)) {
          nextProgress = {
            ...nextProgress,
            visitedPoiIds: [...nextProgress.visitedPoiIds, poi.id],
          };
        }
        if (
          poi.type === 'collectible' &&
          !nextProgress.collectedConceptIds.includes(poi.id)
        ) {
          nextProgress = {
            ...nextProgress,
            collectedConceptIds: [...nextProgress.collectedConceptIds, poi.id],
          };
        }
        nextProgress = applyQuestCompletions(
          dispatch,
          nextProgress,
          subjectWorld.worldSpec.quests
        );
        maybeMarkWorldComplete(nextProgress);
        persistProgress(nextProgress);
        return;
      }

      const gate = subjectWorld.worldSpec.gates.find((g) => g.id === marker.id);
      if (gate && !pageState.progress.unlockedGateIds.includes(gate.id)) {
        dispatch(openGate(gate));
      }
    },
    [
      dispatch,
      maybeMarkWorldComplete,
      pageState.progress,
      persistProgress,
      subjectWorld?.worldSpec,
    ]
  );

  const handleClosePanel = useCallback(() => {
    dispatch(closePoi());
    dispatch(closeGate());
  }, [dispatch]);

  const handleInteract = useCallback(() => {
    if (pageState.activePoi || pageState.activeGate) {
      handleClosePanel();
      return;
    }
    const marker = nearMarkerRef.current;
    if (!marker) return;
    interactWithMarker(marker);
  }, [
    handleClosePanel,
    interactWithMarker,
    pageState.activeGate,
    pageState.activePoi,
  ]);

  const handleInteractMarker = useCallback(
    (marker: ISceneMarker) => {
      interactWithMarker(marker);
    },
    [interactWithMarker]
  );

  const handleSelectGateAnswer = useCallback(
    (index: number) => {
      dispatch(selectGateAnswer(index));
    },
    [dispatch]
  );

  const handleSubmitGateAnswer = useCallback(() => {
    const gate = pageState.activeGate;
    if (!gate || pageState.selectedGateAnswer === null || !subjectWorld?.worldSpec) return;

    if (pageState.selectedGateAnswer !== gate.correctAnswer) {
      dispatch(setGateAnswerWrong());
      return;
    }

    dispatch(unlockGate(gate.id));
    let nextProgress: SubjectWorldProgressSnapshot = {
      ...pageState.progress,
      unlockedGateIds: pageState.progress.unlockedGateIds.includes(gate.id)
        ? pageState.progress.unlockedGateIds
        : [...pageState.progress.unlockedGateIds, gate.id],
    };
    nextProgress = applyQuestCompletions(
      dispatch,
      nextProgress,
      subjectWorld.worldSpec.quests
    );
    maybeMarkWorldComplete(nextProgress);
    persistProgress(nextProgress);
  }, [
    dispatch,
    maybeMarkWorldComplete,
    pageState.activeGate,
    pageState.progress,
    pageState.selectedGateAnswer,
    persistProgress,
    subjectWorld?.worldSpec,
  ]);

  return {
    handleBackToDirectory,
    handleNearMarkerChange,
    handleInteract,
    handleInteractMarker,
    handleClosePanel,
    handleSelectGateAnswer,
    handleSubmitGateAnswer,
  };
};
