import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../index';
import { TocItem } from '../../components/MarkdownRenderer';

interface DocumentViewerPageState {
  tocItems: TocItem[];
  showToc: boolean;
  isExporting: boolean;
  questionAnswer: string | null;
  isAskingQuestion: boolean;
  questionError: string | null;
}

const initialState: DocumentViewerPageState = {
  tocItems: [],
  showToc: false,
  isExporting: false,
  questionAnswer: null,
  isAskingQuestion: false,
  questionError: null,
};

const documentViewerPageSlice = createSlice({
  name: 'documentViewerPage',
  initialState,
  reducers: {
    setTocItems: (state, action: PayloadAction<TocItem[]>) => {
      state.tocItems = action.payload;
    },
    setShowToc: (state, action: PayloadAction<boolean>) => {
      state.showToc = action.payload;
    },
    toggleToc: (state) => {
      state.showToc = !state.showToc;
    },
    setIsExporting: (state, action: PayloadAction<boolean>) => {
      state.isExporting = action.payload;
    },
    setQuestionAsking: (state, action: PayloadAction<boolean>) => {
      state.isAskingQuestion = action.payload;
      state.questionError = null;
    },
    setQuestionAnswer: (state, action: PayloadAction<string>) => {
      state.questionAnswer = action.payload;
      state.isAskingQuestion = false;
    },
    setQuestionError: (state, action: PayloadAction<string>) => {
      state.questionError = action.payload;
      state.isAskingQuestion = false;
    },
    clearQuestionAnswer: (state) => {
      state.questionAnswer = null;
      state.questionError = null;
    },
  },
});

export const {
  setTocItems,
  setShowToc,
  toggleToc,
  setIsExporting,
  setQuestionAsking,
  setQuestionAnswer,
  setQuestionError,
  clearQuestionAnswer,
} = documentViewerPageSlice.actions;

// Selectors
export const selectTocItems = (state: RootState) => state.documentViewerPage.tocItems;
export const selectShowToc = (state: RootState) => state.documentViewerPage.showToc;
export const selectIsExporting = (state: RootState) => state.documentViewerPage.isExporting;
export const selectQuestionAnswer = (state: RootState) => state.documentViewerPage.questionAnswer;
export const selectIsAskingQuestion = (state: RootState) => state.documentViewerPage.isAskingQuestion;
export const selectQuestionError = (state: RootState) => state.documentViewerPage.questionError;

export default documentViewerPageSlice.reducer;