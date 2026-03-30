import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DiagramQuiz } from '@shared-types';
import { IDiagramQuizAnswer, IDiagramQuizQuestion } from '../../pages/DiagramQuizPage/types/IDiagramQuizTypes';

interface DiagramQuizPageState {
  firestoreDiagramQuiz: DiagramQuiz | null;
  questions: IDiagramQuizQuestion[];
  currentQuestionIndex: number;
  currentDiagramIndex: number;
  selectedAnswer: number | null;
  showExplanation: boolean;
  score: number;
  answers: IDiagramQuizAnswer[];
  isCompleted: boolean;
  startTime: number | null;
  endTime: number | null;
  isLoading: boolean;
  error: string | null;
  isSubmitting: boolean;
  formErrors: Record<string, string>;
}

const initialState: DiagramQuizPageState = {
  firestoreDiagramQuiz: null,
  questions: [],
  currentQuestionIndex: 0,
  currentDiagramIndex: 0,
  selectedAnswer: null,
  showExplanation: false,
  score: 0,
  answers: [],
  isCompleted: false,
  startTime: null,
  endTime: null,
  isLoading: false,
  error: null,
  isSubmitting: false,
  formErrors: {},
};

const diagramQuizPageSlice = createSlice({
  name: 'diagramQuizPage',
  initialState,
  reducers: {
    loadDiagramQuiz: (
      state,
      action: PayloadAction<{ diagramQuiz: DiagramQuiz; questions: IDiagramQuizQuestion[] }>
    ) => {
      state.firestoreDiagramQuiz = action.payload.diagramQuiz;
      state.questions = action.payload.questions;
      state.currentQuestionIndex = 0;
      state.currentDiagramIndex = 0;
      state.selectedAnswer = null;
      state.showExplanation = false;
      state.score = 0;
      state.answers = [];
      state.isCompleted = false;
      state.startTime = Date.now();
      state.endTime = null;
      state.error = null;
    },
    startDiagramQuiz: (state, action: PayloadAction<{ questions: IDiagramQuizQuestion[] }>) => {
      state.questions = action.payload.questions;
      state.currentQuestionIndex = 0;
      state.currentDiagramIndex = 0;
      state.selectedAnswer = null;
      state.showExplanation = false;
      state.score = 0;
      state.answers = [];
      state.isCompleted = false;
      state.startTime = Date.now();
      state.endTime = null;
      state.error = null;
    },
    setCurrentDiagramIndex: (state, action: PayloadAction<{ index: number }>) => {
      state.currentDiagramIndex = Math.max(0, Math.min(3, action.payload.index));
    },
    answerDiagramQuestion: (state, action: PayloadAction<{ answerIndex: number }>) => {
      if (state.selectedAnswer !== null) return;

      state.selectedAnswer = action.payload.answerIndex;
      state.showExplanation = true;

      const currentQuestion = state.questions[state.currentQuestionIndex];
      const isCorrect = action.payload.answerIndex === currentQuestion.correct;

      if (isCorrect) {
        state.score += 1;
      }

      const answer: IDiagramQuizAnswer = {
        questionId: currentQuestion.id,
        selected: action.payload.answerIndex,
        correct: currentQuestion.correct,
        isCorrect,
        timeSpent: state.startTime ? Date.now() - state.startTime : 0,
      };
      state.answers.push(answer);
    },
    nextDiagramQuestion: (state) => {
      if (state.currentQuestionIndex < state.questions.length - 1) {
        state.currentQuestionIndex += 1;
        state.currentDiagramIndex = 0;
        state.selectedAnswer = null;
        state.showExplanation = false;
        state.formErrors = {};
      } else {
        state.isCompleted = true;
        state.endTime = Date.now();
      }
    },
    completeDiagramQuiz: (state) => {
      state.isCompleted = true;
      state.endTime = Date.now();
    },
    resetDiagramQuiz: (state) => {
      Object.assign(state, initialState);
    },
    restartDiagramQuizSession: (state) => {
      if (state.questions.length === 0) return;
      state.currentQuestionIndex = 0;
      state.currentDiagramIndex = 0;
      state.selectedAnswer = null;
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
  loadDiagramQuiz,
  startDiagramQuiz,
  setCurrentDiagramIndex,
  answerDiagramQuestion,
  nextDiagramQuestion,
  completeDiagramQuiz,
  resetDiagramQuiz,
  restartDiagramQuizSession,
  setLoading,
  setError,
} = diagramQuizPageSlice.actions;

export const selectDiagramQuizState = (state: { diagramQuizPage: DiagramQuizPageState }) =>
  state.diagramQuizPage;
export const selectCurrentDiagramQuestion = (state: { diagramQuizPage: DiagramQuizPageState }) => {
  const { questions, currentQuestionIndex } = state.diagramQuizPage;
  return questions[currentQuestionIndex] || null;
};
export const selectDiagramQuizProgress = (state: { diagramQuizPage: DiagramQuizPageState }) => {
  const { currentQuestionIndex, questions } = state.diagramQuizPage;
  return questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;
};
export const selectDiagramQuizStats = (state: { diagramQuizPage: DiagramQuizPageState }) => {
  const { score, questions, answers, startTime, endTime } = state.diagramQuizPage;
  const totalQuestions = questions.length;
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const timeTaken = startTime && endTime ? endTime - startTime : 0;
  return {
    score,
    totalQuestions,
    percentage,
    timeTaken,
    answersBreakdown: answers,
  };
};
export const selectDiagramFormState = (state: { diagramQuizPage: DiagramQuizPageState }) => ({
  selectedAnswer: state.diagramQuizPage.selectedAnswer,
  isSubmitting: state.diagramQuizPage.isSubmitting,
  errors: state.diagramQuizPage.formErrors,
});

export default diagramQuizPageSlice.reducer;
