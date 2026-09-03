import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { MatchQuiz, MatchQuizOption } from '@shared-types';

export interface IMatchQuizViewQuestion {
  id: number;
  prompts: Array<{ id: string; text: string }>;
  options: MatchQuizOption[];
  explanation: string;
  hint?: string;
}

export interface IMatchQuizAnswer {
  questionId: number;
  /** Placed option ids in prompt-row order (prompts[i] -> placedOptionIds[i]). */
  placedOptionIds: string[];
  correctOptionIds: string[];
  isCorrect: boolean;
  timeSpent?: number;
}

interface IMatchQuizPageState {
  firestoreMatchQuiz: MatchQuiz | null;
  questions: IMatchQuizViewQuestion[];
  currentQuestionIndex: number;
  /** Option ids still in the chip bank (shuffled on load). */
  bankOptionIds: string[];
  /** promptId -> optionId placed in that row. */
  placements: Record<string, string>;
  /** Prompt rows locked after a correct match on submit. */
  lockedPromptIds: string[];
  isChecked: boolean;
  isCorrect: boolean | null;
  showExplanation: boolean;
  score: number;
  answers: IMatchQuizAnswer[];
  isCompleted: boolean;
  quizStartTime: number | null;
  questionStartTime: number | null;
  endTime: number | null;
  isLoading: boolean;
  error: string | null;
  followupGenerated: Record<number, boolean>;
  followupContent: Record<number, string>;
  followupChatOpen: Record<number, boolean>;
  isGeneratingFollowup: boolean;
  followupError: string | null;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function bankIdsFor(question: IMatchQuizViewQuestion | undefined): string[] {
  return shuffleArray(question?.options.map((option) => option.id) ?? []);
}

const initialState: IMatchQuizPageState = {
  firestoreMatchQuiz: null,
  questions: [],
  currentQuestionIndex: 0,
  bankOptionIds: [],
  placements: {},
  lockedPromptIds: [],
  isChecked: false,
  isCorrect: null,
  showExplanation: false,
  score: 0,
  answers: [],
  isCompleted: false,
  quizStartTime: null,
  questionStartTime: null,
  endTime: null,
  isLoading: false,
  error: null,
  followupGenerated: {},
  followupContent: {},
  followupChatOpen: {},
  isGeneratingFollowup: false,
  followupError: null,
};

function emptyBoardFor(question: IMatchQuizViewQuestion | undefined): {
  bankOptionIds: string[];
  placements: Record<string, string>;
  lockedPromptIds: string[];
} {
  return {
    bankOptionIds: bankIdsFor(question),
    placements: {},
    lockedPromptIds: [],
  };
}

const matchQuizPageSlice = createSlice({
  name: 'matchQuizPage',
  initialState,
  reducers: {
    loadMatchQuiz: (
      state,
      action: PayloadAction<{
        matchQuiz: MatchQuiz;
        questions: IMatchQuizViewQuestion[];
      }>,
    ) => {
      const now = Date.now();
      state.firestoreMatchQuiz = action.payload.matchQuiz;
      state.questions = action.payload.questions;
      state.currentQuestionIndex = 0;
      Object.assign(state, emptyBoardFor(action.payload.questions[0]));
      state.isChecked = false;
      state.isCorrect = null;
      state.showExplanation = false;
      state.score = 0;
      state.answers = [];
      state.isCompleted = false;
      state.quizStartTime = now;
      state.questionStartTime = now;
      state.endTime = null;
      state.error = null;
      state.followupGenerated = {};
      state.followupContent = {};
      state.followupChatOpen = {};
      state.isGeneratingFollowup = false;
      state.followupError = null;
    },

    placeOption: (
      state,
      action: PayloadAction<{ promptId: string; optionId: string }>,
    ) => {
      if (state.isCorrect) return;
      const { promptId, optionId } = action.payload;
      if (state.lockedPromptIds.includes(promptId)) return;

      const currentOwner = Object.keys(state.placements).find(
        (key) => state.placements[key] === optionId,
      );
      if (currentOwner && state.lockedPromptIds.includes(currentOwner)) return;

      const bankIdx = state.bankOptionIds.indexOf(optionId);
      if (bankIdx === -1 && currentOwner === undefined) return;
      if (currentOwner === promptId) return;

      const displacedOptionId = state.placements[promptId];
      if (currentOwner !== undefined) {
        delete state.placements[currentOwner];
      } else {
        state.bankOptionIds.splice(bankIdx, 1);
      }

      state.placements[promptId] = optionId;
      if (displacedOptionId) {
        state.bankOptionIds.push(displacedOptionId);
      }
    },

    removeOption: (state, action: PayloadAction<{ promptId: string }>) => {
      if (state.isCorrect) return;
      if (state.lockedPromptIds.includes(action.payload.promptId)) return;
      const optionId = state.placements[action.payload.promptId];
      if (!optionId) return;
      delete state.placements[action.payload.promptId];
      state.bankOptionIds.push(optionId);
    },

    resetBoard: (state) => {
      if (state.isCorrect) return;
      const currentQuestion = state.questions[state.currentQuestionIndex];
      if (!currentQuestion) return;
      const locked = new Set(state.lockedPromptIds);
      const kept: Record<string, string> = {};
      for (const promptId of Object.keys(state.placements)) {
        if (locked.has(promptId)) {
          kept[promptId] = state.placements[promptId];
        }
      }
      const used = new Set(Object.values(kept));
      state.placements = kept;
      state.bankOptionIds = bankIdsFor(currentQuestion).filter(
        (id) => !used.has(id),
      );
      state.showExplanation = false;
    },

    retryAfterCheck: (state) => {
      if (state.isCorrect) return;
      state.showExplanation = false;
    },

    checkAnswer: (state) => {
      if (state.isCorrect) return;
      const currentQuestion = state.questions[state.currentQuestionIndex];
      if (!currentQuestion) return;

      const prompts = currentQuestion.prompts;
      const allPlaced = prompts.every((prompt) => state.placements[prompt.id]);
      if (!allPlaced) return;

      const placedOptionIds = prompts.map(
        (prompt) => state.placements[prompt.id],
      );
      const correctOptionIds = prompts.map((prompt) => {
        const option = currentQuestion.options.find(
          (candidate) => candidate.correctPromptId === prompt.id,
        );
        return option ? option.id : '';
      });
      const isFullyCorrect = placedOptionIds.every(
        (optionId, i) => optionId === correctOptionIds[i],
      );

      const nextLocked = [...state.lockedPromptIds];
      prompts.forEach((prompt, index) => {
        if (placedOptionIds[index] === correctOptionIds[index]) {
          if (!nextLocked.includes(prompt.id)) {
            nextLocked.push(prompt.id);
          }
          return;
        }
        delete state.placements[prompt.id];
        state.bankOptionIds.push(placedOptionIds[index]);
      });
      state.lockedPromptIds = nextLocked;

      state.isChecked = true;
      state.isCorrect = isFullyCorrect;
      state.showExplanation = true;

      const alreadyRecorded = state.answers.some(
        (answer) => answer.questionId === currentQuestion.id,
      );
      if (!alreadyRecorded) {
        if (isFullyCorrect) {
          state.score += 1;
        }
        const answer: IMatchQuizAnswer = {
          questionId: currentQuestion.id,
          placedOptionIds,
          correctOptionIds,
          isCorrect: isFullyCorrect,
          timeSpent: state.questionStartTime
            ? Date.now() - state.questionStartTime
            : 0,
        };
        state.answers.push(answer);
      }
    },

    nextMatchQuestion: (state) => {
      if (!state.isCorrect) return;
      if (state.currentQuestionIndex < state.questions.length - 1) {
        state.currentQuestionIndex += 1;
        const nextQuestion = state.questions[state.currentQuestionIndex];
        Object.assign(state, emptyBoardFor(nextQuestion));
        state.isChecked = false;
        state.isCorrect = null;
        state.showExplanation = false;
        state.questionStartTime = Date.now();
        state.followupError = null;
      } else {
        state.isCompleted = true;
        state.endTime = Date.now();
      }
    },

    completeMatchQuiz: (state) => {
      state.isCompleted = true;
      state.endTime = Date.now();
    },

    resetMatchQuiz: () => initialState,

    restartMatchQuizSession: (state) => {
      if (state.questions.length === 0) return;
      const now = Date.now();
      state.currentQuestionIndex = 0;
      Object.assign(state, emptyBoardFor(state.questions[0]));
      state.isChecked = false;
      state.isCorrect = null;
      state.showExplanation = false;
      state.score = 0;
      state.answers = [];
      state.isCompleted = false;
      state.quizStartTime = now;
      state.questionStartTime = now;
      state.endTime = null;
      state.error = null;
      state.followupGenerated = {};
      state.followupContent = {};
      state.isGeneratingFollowup = false;
      state.followupError = null;
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    setMatchFollowupGenerating: (state, action: PayloadAction<boolean>) => {
      state.isGeneratingFollowup = action.payload;
      state.followupError = null;
    },

    setMatchFollowupGenerated: (
      state,
      action: PayloadAction<{ questionIndex: number; content: string }>,
    ) => {
      state.followupGenerated[action.payload.questionIndex] = true;
      state.followupContent[action.payload.questionIndex] =
        action.payload.content;
      state.isGeneratingFollowup = false;
    },

    setMatchFollowupError: (state, action: PayloadAction<string | null>) => {
      state.followupError = action.payload;
      state.isGeneratingFollowup = false;
    },

    openMatchFollowupChat: (
      state,
      action: PayloadAction<{ questionIndex: number }>,
    ) => {
      state.followupChatOpen[action.payload.questionIndex] = true;
      state.followupGenerated[action.payload.questionIndex] = true;
      state.isGeneratingFollowup = false;
      state.followupError = null;
    },
  },
});

export const {
  loadMatchQuiz,
  placeOption,
  removeOption,
  resetBoard,
  retryAfterCheck,
  checkAnswer,
  nextMatchQuestion,
  completeMatchQuiz,
  resetMatchQuiz,
  restartMatchQuizSession,
  setLoading,
  setError,
  setMatchFollowupGenerating,
  setMatchFollowupGenerated,
  setMatchFollowupError,
  openMatchFollowupChat,
} = matchQuizPageSlice.actions;

export const selectMatchQuizState = (state: {
  matchQuizPage: IMatchQuizPageState;
}) => state.matchQuizPage;

export const selectCurrentMatchQuestion = (state: {
  matchQuizPage: IMatchQuizPageState;
}) => {
  const { questions, currentQuestionIndex } = state.matchQuizPage;
  return questions[currentQuestionIndex] ?? null;
};

export const selectMatchQuizProgress = (state: {
  matchQuizPage: IMatchQuizPageState;
}) => {
  const { currentQuestionIndex, questions } = state.matchQuizPage;
  return questions.length > 0
    ? ((currentQuestionIndex + 1) / questions.length) * 100
    : 0;
};

export const selectMatchQuizStats = (state: {
  matchQuizPage: IMatchQuizPageState;
}) => {
  const { score, questions, answers, quizStartTime, endTime } =
    state.matchQuizPage;
  const totalQuestions = questions.length;
  const percentage =
    totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const timeTaken = quizStartTime && endTime ? endTime - quizStartTime : 0;
  return {
    score,
    totalQuestions,
    percentage,
    timeTaken,
    answersBreakdown: answers,
  };
};

export default matchQuizPageSlice.reducer;
