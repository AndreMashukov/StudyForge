import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IQuizQuestion, IQuizAnswer } from '../../pages/QuizPage/types/IQuizTypes';
import { Quiz } from '@shared-types';

interface QuizPageState {
  // Core quiz data
  firestoreQuiz: Quiz | null;
  questions: IQuizQuestion[];
  currentQuestionIndex: number;
  selectedAnswer: number | null;
  showExplanation: boolean;
  score: number;
  answers: IQuizAnswer[];
  isCompleted: boolean;
  startTime: number | null;
  endTime: number | null;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Form state
  isSubmitting: boolean;
  formErrors: Record<string, string>;
}

const initialState: QuizPageState = {
  // Core quiz data
  firestoreQuiz: null,
  questions: [],
  currentQuestionIndex: 0,
  selectedAnswer: null,
  showExplanation: false,
  score: 0,
  answers: [],
  isCompleted: false,
  startTime: null,
  endTime: null,
  
  // UI state
  isLoading: false,
  error: null,
  
  // Form state
  isSubmitting: false,
  formErrors: {},
};

const quizPageSlice = createSlice({
  name: 'quizPage',
  initialState,
  reducers: {
    // Load quiz from Firestore
    loadQuiz: (state, action: PayloadAction<{ quiz: Quiz; questions: IQuizQuestion[] }>) => {
      state.firestoreQuiz = action.payload.quiz;
      state.questions = action.payload.questions;
      state.currentQuestionIndex = 0;
      state.selectedAnswer = null;
      state.showExplanation = false;
      state.score = 0;
      state.answers = [];
      state.isCompleted = false;
      state.startTime = null;
      state.endTime = null;
      state.error = null;
    },
    // Quiz lifecycle actions
    startQuiz: (state, action: PayloadAction<{ questions: IQuizQuestion[] }>) => {
      state.questions = action.payload.questions;
      state.currentQuestionIndex = 0;
      state.selectedAnswer = null;
      state.showExplanation = false;
      state.score = 0;
      state.answers = [];
      state.isCompleted = false;
      state.startTime = Date.now();
      state.endTime = null;
      state.error = null;
    },
    
    selectAnswer: (state, action: PayloadAction<{ answerIndex: number }>) => {
      if (state.selectedAnswer !== null) return; // Prevent changing answer
      
      state.selectedAnswer = action.payload.answerIndex;
      state.showExplanation = true;
      
      const currentQuestion = state.questions[state.currentQuestionIndex];
      const isCorrect = action.payload.answerIndex === currentQuestion.correct;
      
      if (isCorrect) {
        state.score += 1;
      }
      
      // Add answer to answers array
      const answer: IQuizAnswer = {
        questionId: currentQuestion.id,
        selected: action.payload.answerIndex,
        correct: currentQuestion.correct,
        isCorrect,
        timeSpent: state.startTime ? Date.now() - state.startTime : 0,
      };
      
      state.answers.push(answer);
    },
    
    nextQuestion: (state) => {
      if (state.currentQuestionIndex < state.questions.length - 1) {
        state.currentQuestionIndex += 1;
        state.selectedAnswer = null;
        state.showExplanation = false;
        state.formErrors = {};
      } else {
        state.isCompleted = true;
        state.endTime = Date.now();
      }
    },
    
    completeQuiz: (state) => {
      state.isCompleted = true;
      state.endTime = Date.now();
    },
    
    resetQuiz: (state) => {
      Object.assign(state, initialState);
    },
    
    // UI state actions
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    // Form state actions
    setSubmitting: (state, action: PayloadAction<boolean>) => {
      state.isSubmitting = action.payload;
    },
    
    setFormErrors: (state, action: PayloadAction<Record<string, string>>) => {
      state.formErrors = action.payload;
    },
    
    clearFormErrors: (state) => {
      state.formErrors = {};
    },
    
    // Advanced quiz actions
    skipQuestion: (state) => {
      if (state.selectedAnswer === null) {
        // Mark as skipped with -1 answer
        const currentQuestion = state.questions[state.currentQuestionIndex];
        const answer: IQuizAnswer = {
          questionId: currentQuestion.id,
          selected: -1, // Indicates skipped
          correct: currentQuestion.correct,
          isCorrect: false,
          timeSpent: state.startTime ? Date.now() - state.startTime : 0,
        };
        
        state.answers.push(answer);
        state.showExplanation = true;
      }
    },
  },
});

// Action creators
export const {
  loadQuiz,
  startQuiz,
  selectAnswer,
  nextQuestion,
  completeQuiz,
  resetQuiz,
  setLoading,
  setError,
  clearError,
  setSubmitting,
  setFormErrors,
  clearFormErrors,
  skipQuestion,
} = quizPageSlice.actions;

// Selectors
export const selectQuizState = (state: { quizPage: QuizPageState }) => state.quizPage;
export const selectFirestoreQuiz = (state: { quizPage: QuizPageState }) => state.quizPage.firestoreQuiz;
export const selectCurrentQuestion = (state: { quizPage: QuizPageState }) => {
  const { questions, currentQuestionIndex } = state.quizPage;
  return questions[currentQuestionIndex] || null;
};
export const selectProgress = (state: { quizPage: QuizPageState }) => {
  const { currentQuestionIndex, questions } = state.quizPage;
  return questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;
};
export const selectQuizStats = (state: { quizPage: QuizPageState }) => {
  const { score, questions, answers, startTime, endTime } = state.quizPage;
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
export const selectIsLoading = (state: { quizPage: QuizPageState }) => state.quizPage.isLoading;
export const selectError = (state: { quizPage: QuizPageState }) => state.quizPage.error;
export const selectFormState = (state: { quizPage: QuizPageState }) => ({
  selectedAnswer: state.quizPage.selectedAnswer,
  isSubmitting: state.quizPage.isSubmitting,
  errors: state.quizPage.formErrors,
});

export default quizPageSlice.reducer;