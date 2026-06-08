import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { RootState } from '../index';
import {
  SubjectWorldGate,
  SubjectWorldPoi,
  SubjectWorldProgressSnapshot,
  SubjectWorldQuest,
} from '@shared-types';

export type SubjectWorldGameplayPhase =
  | 'loading'
  | 'exploring'
  | 'readingPoi'
  | 'answeringGate'
  | 'completed';

export type SubjectWorldGateAnswerFeedback = 'none' | 'wrong' | 'correct';

export interface ISubjectWorldPageState {
  phase: SubjectWorldGameplayPhase;
  activePoi: SubjectWorldPoi | null;
  activeGate: SubjectWorldGate | null;
  selectedGateAnswer: number | null;
  gateAnswerFeedback: SubjectWorldGateAnswerFeedback;
  progress: SubjectWorldProgressSnapshot;
}

const emptyProgress = (): SubjectWorldProgressSnapshot => ({
  visitedPoiIds: [],
  unlockedGateIds: [],
  completedQuestIds: [],
  collectedConceptIds: [],
});

const initialState: ISubjectWorldPageState = {
  phase: 'loading',
  activePoi: null,
  activeGate: null,
  selectedGateAnswer: null,
  gateAnswerFeedback: 'none',
  progress: emptyProgress(),
};

const subjectWorldPageSlice = createSlice({
  name: 'subjectWorldPage',
  initialState,
  reducers: {
    resetSubjectWorldPage: () => initialState,
    setSubjectWorldPhase: (state, action: PayloadAction<SubjectWorldGameplayPhase>) => {
      state.phase = action.payload;
    },
    loadSubjectWorldProgress: (state, action: PayloadAction<SubjectWorldProgressSnapshot | null>) => {
      state.progress = action.payload ?? emptyProgress();
      state.phase = 'exploring';
    },
    openPoi: (state, action: PayloadAction<SubjectWorldPoi>) => {
      state.activePoi = action.payload;
      state.activeGate = null;
      state.selectedGateAnswer = null;
      state.gateAnswerFeedback = 'none';
      state.phase = 'readingPoi';
      if (!state.progress.visitedPoiIds.includes(action.payload.id)) {
        state.progress.visitedPoiIds.push(action.payload.id);
      }
      if (
        action.payload.type === 'collectible' &&
        !state.progress.collectedConceptIds.includes(action.payload.id)
      ) {
        state.progress.collectedConceptIds.push(action.payload.id);
      }
    },
    closePoi: (state) => {
      state.activePoi = null;
      state.phase = 'exploring';
    },
    openGate: (state, action: PayloadAction<SubjectWorldGate>) => {
      state.activeGate = action.payload;
      state.activePoi = null;
      state.selectedGateAnswer = null;
      state.gateAnswerFeedback = 'none';
      state.phase = 'answeringGate';
    },
    closeGate: (state) => {
      state.activeGate = null;
      state.selectedGateAnswer = null;
      state.gateAnswerFeedback = 'none';
      state.phase = 'exploring';
    },
    selectGateAnswer: (state, action: PayloadAction<number>) => {
      state.selectedGateAnswer = action.payload;
      state.gateAnswerFeedback = 'none';
    },
    setGateAnswerWrong: (state) => {
      state.gateAnswerFeedback = 'wrong';
    },
    unlockGate: (state, action: PayloadAction<string>) => {
      if (!state.progress.unlockedGateIds.includes(action.payload)) {
        state.progress.unlockedGateIds.push(action.payload);
      }
      state.gateAnswerFeedback = 'correct';
      state.activeGate = null;
      state.selectedGateAnswer = null;
      state.phase = 'exploring';
    },
    completeQuest: (state, action: PayloadAction<string>) => {
      if (!state.progress.completedQuestIds.includes(action.payload)) {
        state.progress.completedQuestIds.push(action.payload);
      }
    },
    setLastPosition: (
      state,
      action: PayloadAction<{ lastZoneId?: string; lastPosition?: SubjectWorldProgressSnapshot['lastPosition'] }>
    ) => {
      state.progress.lastZoneId = action.payload.lastZoneId;
      state.progress.lastPosition = action.payload.lastPosition;
    },
    markWorldCompleted: (state) => {
      state.phase = 'completed';
    },
  },
});

export const {
  resetSubjectWorldPage,
  setSubjectWorldPhase,
  loadSubjectWorldProgress,
  openPoi,
  closePoi,
  openGate,
  closeGate,
  selectGateAnswer,
  setGateAnswerWrong,
  unlockGate,
  completeQuest,
  setLastPosition,
  markWorldCompleted,
} = subjectWorldPageSlice.actions;

export const selectSubjectWorldPageState = (state: RootState) => state.subjectWorldPage;
export const selectSubjectWorldProgress = (state: RootState) => state.subjectWorldPage.progress;
export const selectSubjectWorldPhase = (state: RootState) => state.subjectWorldPage.phase;

export function isQuestComplete(
  quest: SubjectWorldQuest,
  progress: SubjectWorldProgressSnapshot
): boolean {
  const poisDone = quest.poiIds.every((id) => progress.visitedPoiIds.includes(id));
  const gatesDone = (quest.gateIds ?? []).every(
    (id) => progress.unlockedGateIds.includes(id)
  );
  return poisDone && gatesDone;
}

export function getQuestProgress(
  quest: SubjectWorldQuest,
  progress: SubjectWorldProgressSnapshot
): { completed: number; total: number } {
  const poiTotal = quest.poiIds.length;
  const gateTotal = quest.gateIds?.length ?? 0;
  const poiDone = quest.poiIds.filter((id) => progress.visitedPoiIds.includes(id)).length;
  const gateDone = (quest.gateIds ?? []).filter((id) =>
    progress.unlockedGateIds.includes(id)
  ).length;
  return {
    completed: poiDone + gateDone,
    total: poiTotal + gateTotal,
  };
}

export function areAllQuestsComplete(
  quests: SubjectWorldQuest[],
  progress: SubjectWorldProgressSnapshot
): boolean {
  if (quests.length === 0) return false;
  return quests.every(
    (quest) =>
      isQuestComplete(quest, progress) || progress.completedQuestIds.includes(quest.id)
  );
}

export default subjectWorldPageSlice.reducer;
