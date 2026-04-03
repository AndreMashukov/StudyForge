import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SequenceQuiz } from '@shared-types';

export interface ISequenceQuizQuestion {
  id: number;
  question: string;
  items: string[]; // Correct order
  explanation: string;
}

export interface ISequenceQuizAnswer {
  questionId: number;
  placedItems: string[];
  correctItems: string[];
  isCorrect: boolean;
  timeSpent?: number;
}

interface SequenceQuizPageState {
  firestoreSequenceQuiz: SequenceQuiz | null;
  questions: ISequenceQuizQuestion[];
  currentQuestionIndex: number;
  availableItems: string[];   // Items still in the pool (shuffled)
  placedItems: string[];      // Items placed on the sequence board (user's order)
  isChecked: boolean;
  isCorrect: boolean | null;
  showExplanation: boolean;
  score: number;
  answers: ISequenceQuizAnswer[];
  isCompleted: boolean;
  startTime: number | null;
  endTime: number | null;
  isLoading: boolean;
  error: string | null;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const initialState: SequenceQuizPageState = {
  firestoreSequenceQuiz: null,
  questions: [],
  currentQuestionIndex: 0,
  availableItems: [],
  placedItems: [],
  isChecked: false,
  isCorrect: null,
  showExplanation: false,
  score: 0,
  answers: [],
  isCompleted: false,
  startTime: null,
  endTime: null,
  isLoading: false,
  error: null,
};

const sequenceQuizPageSlice = createSlice({
  name: 'sequenceQuizPage',
  initialState,
  reducers: {
    loadSequenceQuiz: (
      state,
      action: PayloadAction<{ sequenceQuiz: SequenceQuiz; questions: ISequenceQuizQuestion[] }>
    ) => {
      state.firestoreSequenceQuiz = action.payload.sequenceQuiz;
      state.questions = action.payload.questions;
      state.currentQuestionIndex = 0;
      state.availableItems = shuffleArray(action.payload.questions[0]?.items ?? []);
      state.placedItems = [];
      state.isChecked = false;
      state.isCorrect = null;
      state.showExplanation = false;
      state.score = 0;
      state.answers = [];
      state.isCompleted = false;
      state.startTime = Date.now();
      state.endTime = null;
      state.error = null;
    },

    placeItem: (state, action: PayloadAction<{ item: string; atIndex?: number }>) => {
      if (state.isChecked) return;
      const { item, atIndex } = action.payload;
      const idx = state.availableItems.indexOf(item);
      if (idx === -1) return;
      state.availableItems.splice(idx, 1);
      if (atIndex !== undefined && atIndex >= 0 && atIndex <= state.placedItems.length) {
        state.placedItems.splice(atIndex, 0, item);
      } else {
        state.placedItems.push(item);
      }
    },

    removeItem: (state, action: PayloadAction<{ item: string }>) => {
      if (state.isChecked) return;
      const idx = state.placedItems.indexOf(action.payload.item);
      if (idx === -1) return;
      state.placedItems.splice(idx, 1);
      state.availableItems.push(action.payload.item);
    },

    reorderPlacedItem: (
      state,
      action: PayloadAction<{ fromIndex: number; toIndex: number }>
    ) => {
      if (state.isChecked) return;
      const { fromIndex, toIndex } = action.payload;
      if (
        fromIndex < 0 ||
        fromIndex >= state.placedItems.length ||
        toIndex < 0 ||
        toIndex >= state.placedItems.length
      ) {
        return;
      }
      const [moved] = state.placedItems.splice(fromIndex, 1);
      state.placedItems.splice(toIndex, 0, moved);
    },

    resetBoard: (state) => {
      if (state.isChecked) return;
      const currentQuestion = state.questions[state.currentQuestionIndex];
      if (!currentQuestion) return;
      state.availableItems = shuffleArray(currentQuestion.items);
      state.placedItems = [];
    },

    checkAnswer: (state) => {
      if (state.isChecked) return;
      const currentQuestion = state.questions[state.currentQuestionIndex];
      if (!currentQuestion) return;

      const isCorrect = currentQuestion.items.every(
        (item, i) => state.placedItems[i] === item
      ) && state.placedItems.length === currentQuestion.items.length;

      state.isChecked = true;
      state.isCorrect = isCorrect;
      state.showExplanation = true;

      if (isCorrect) {
        state.score += 1;
      }

      const answer: ISequenceQuizAnswer = {
        questionId: currentQuestion.id,
        placedItems: [...state.placedItems],
        correctItems: [...currentQuestion.items],
        isCorrect,
        timeSpent: state.startTime ? Date.now() - state.startTime : 0,
      };
      state.answers.push(answer);
    },

    nextSequenceQuestion: (state) => {
      if (state.currentQuestionIndex < state.questions.length - 1) {
        state.currentQuestionIndex += 1;
        const nextQuestion = state.questions[state.currentQuestionIndex];
        state.availableItems = shuffleArray(nextQuestion?.items ?? []);
        state.placedItems = [];
        state.isChecked = false;
        state.isCorrect = null;
        state.showExplanation = false;
      } else {
        state.isCompleted = true;
        state.endTime = Date.now();
      }
    },

    completeSequenceQuiz: (state) => {
      state.isCompleted = true;
      state.endTime = Date.now();
    },

    resetSequenceQuiz: () => initialState,

    restartSequenceQuizSession: (state) => {
      if (state.questions.length === 0) return;
      state.currentQuestionIndex = 0;
      state.availableItems = shuffleArray(state.questions[0]?.items ?? []);
      state.placedItems = [];
      state.isChecked = false;
      state.isCorrect = null;
      state.showExplanation = false;
      state.score = 0;
      state.answers = [];
      state.isCompleted = false;
      state.startTime = Date.now();
      state.endTime = null;
      state.error = null;
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
  },
});

export const {
  loadSequenceQuiz,
  placeItem,
  removeItem,
  reorderPlacedItem,
  resetBoard,
  checkAnswer,
  nextSequenceQuestion,
  completeSequenceQuiz,
  resetSequenceQuiz,
  restartSequenceQuizSession,
  setLoading,
  setError,
} = sequenceQuizPageSlice.actions;

export const selectSequenceQuizState = (state: { sequenceQuizPage: SequenceQuizPageState }) =>
  state.sequenceQuizPage;

export const selectCurrentSequenceQuestion = (state: { sequenceQuizPage: SequenceQuizPageState }) => {
  const { questions, currentQuestionIndex } = state.sequenceQuizPage;
  return questions[currentQuestionIndex] ?? null;
};

export const selectSequenceQuizProgress = (state: { sequenceQuizPage: SequenceQuizPageState }) => {
  const { currentQuestionIndex, questions } = state.sequenceQuizPage;
  return questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;
};

export const selectSequenceQuizStats = (state: { sequenceQuizPage: SequenceQuizPageState }) => {
  const { score, questions, answers, startTime, endTime } = state.sequenceQuizPage;
  const totalQuestions = questions.length;
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const timeTaken = startTime && endTime ? endTime - startTime : 0;
  return { score, totalQuestions, percentage, timeTaken, answersBreakdown: answers };
};

export default sequenceQuizPageSlice.reducer;
