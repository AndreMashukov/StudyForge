import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { FlashcardCardOutcome } from '../../pages/FlashcardSetPage/types/IFlashcardSetPageContext';

interface FlashcardSetPageState {
  currentIndex: number;
  activeQueue: string[];
  outcomes: Record<string, FlashcardCardOutcome>;
  queueInitializedForSetId: string | null;
}

const initialState: FlashcardSetPageState = {
  currentIndex: 0,
  activeQueue: [],
  outcomes: {},
  queueInitializedForSetId: null,
};

const flashcardSetPageSlice = createSlice({
  name: 'flashcardSetPage',
  initialState,
  reducers: {
    initializeStudySession: (
      state,
      action: PayloadAction<{ setId: string; cardIds: string[] }>
    ) => {
      state.activeQueue = action.payload.cardIds;
      state.outcomes = {};
      state.currentIndex = 0;
      state.queueInitializedForSetId = action.payload.setId;
    },
    advanceCurrentIndex: (state) => {
      state.currentIndex += 1;
    },
    goToNextCard: (state) => {
      state.currentIndex = Math.min(
        state.currentIndex + 1,
        Math.max(state.activeQueue.length - 1, 0)
      );
    },
    goToPrevCard: (state) => {
      state.currentIndex = Math.max(state.currentIndex - 1, 0);
    },
    markCardOutcome: (
      state,
      action: PayloadAction<{ cardId: string; outcome: FlashcardCardOutcome }>
    ) => {
      state.outcomes[action.payload.cardId] = action.payload.outcome;
    },
    startRetake: (state) => {
      const retakeIds = state.activeQueue.filter(
        (cardId) => state.outcomes[cardId] !== 'learned'
      );
      if (retakeIds.length === 0) {
        return;
      }

      state.activeQueue = retakeIds;
      const next: Record<string, FlashcardCardOutcome> = {};
      for (const [cardId, outcome] of Object.entries(state.outcomes)) {
        if (outcome === 'learned') {
          next[cardId] = outcome;
        }
      }
      state.outcomes = next;
      state.currentIndex = 0;
    },
    restartStudySession: (state, action: PayloadAction<{ cardIds: string[] }>) => {
      state.activeQueue = action.payload.cardIds;
      state.outcomes = {};
      state.currentIndex = 0;
    },
  },
});

export const {
  initializeStudySession,
  advanceCurrentIndex,
  goToNextCard,
  goToPrevCard,
  markCardOutcome,
  startRetake,
  restartStudySession,
} = flashcardSetPageSlice.actions;

export const selectFlashcardSetCurrentIndex = (state: {
  flashcardSetPage: FlashcardSetPageState;
}): number => state.flashcardSetPage.currentIndex;

export const selectFlashcardSetActiveQueue = (state: {
  flashcardSetPage: FlashcardSetPageState;
}): string[] => state.flashcardSetPage.activeQueue;

export const selectFlashcardSetOutcomes = (state: {
  flashcardSetPage: FlashcardSetPageState;
}): Record<string, FlashcardCardOutcome> => state.flashcardSetPage.outcomes;

export const selectFlashcardSetQueueInitializedForSetId = (state: {
  flashcardSetPage: FlashcardSetPageState;
}): string | null => state.flashcardSetPage.queueInitializedForSetId;

export default flashcardSetPageSlice.reducer;
