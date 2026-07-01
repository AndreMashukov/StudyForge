import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../index';
import { TocItem } from '../../components/MarkdownRenderer';
import { MarkdownAIAssistantState } from '../../components/MarkdownAIAssistantPanel';

interface DocumentViewerPageState {
  tocItems: TocItem[];
  showToc: boolean;
  isExporting: boolean;
  questionAnswer: string | null;
  isAskingQuestion: boolean;
  questionError: string | null;
  isEditPanelOpen: boolean;
  editAiState: MarkdownAIAssistantState;
  editPreviewContent: string | null;
  editError: string | null;
  isApplyingRevision: boolean;
}

const initialState: DocumentViewerPageState = {
  tocItems: [],
  showToc: false,
  isExporting: false,
  questionAnswer: null,
  isAskingQuestion: false,
  questionError: null,
  isEditPanelOpen: false,
  editAiState: 'idle',
  editPreviewContent: null,
  editError: null,
  isApplyingRevision: false,
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
    setEditPanelOpen: (state, action: PayloadAction<boolean>) => {
      state.isEditPanelOpen = action.payload;
    },
    setEditAiState: (state, action: PayloadAction<MarkdownAIAssistantState>) => {
      state.editAiState = action.payload;
    },
    setEditPreviewContent: (state, action: PayloadAction<string | null>) => {
      state.editPreviewContent = action.payload;
    },
    setEditError: (state, action: PayloadAction<string | null>) => {
      state.editError = action.payload;
    },
    setIsApplyingRevision: (state, action: PayloadAction<boolean>) => {
      state.isApplyingRevision = action.payload;
    },
    resetEditPanelState: (state) => {
      state.isEditPanelOpen = false;
      state.editAiState = 'idle';
      state.editPreviewContent = null;
      state.editError = null;
      state.isApplyingRevision = false;
    },
    resetEditPreview: (state) => {
      state.editAiState = 'idle';
      state.editPreviewContent = null;
      state.editError = null;
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
  setEditPanelOpen,
  setEditAiState,
  setEditPreviewContent,
  setEditError,
  setIsApplyingRevision,
  resetEditPanelState,
  resetEditPreview,
} = documentViewerPageSlice.actions;

export const selectTocItems = (state: RootState) => state.documentViewerPage.tocItems;
export const selectShowToc = (state: RootState) => state.documentViewerPage.showToc;
export const selectIsExporting = (state: RootState) => state.documentViewerPage.isExporting;
export const selectQuestionAnswer = (state: RootState) => state.documentViewerPage.questionAnswer;
export const selectIsAskingQuestion = (state: RootState) =>
  state.documentViewerPage.isAskingQuestion;
export const selectQuestionError = (state: RootState) => state.documentViewerPage.questionError;
export const selectIsEditPanelOpen = (state: RootState) =>
  state.documentViewerPage.isEditPanelOpen;
export const selectEditAiState = (state: RootState) => state.documentViewerPage.editAiState;
export const selectEditPreviewContent = (state: RootState) =>
  state.documentViewerPage.editPreviewContent;
export const selectEditError = (state: RootState) => state.documentViewerPage.editError;
export const selectIsApplyingRevision = (state: RootState) =>
  state.documentViewerPage.isApplyingRevision;
export const selectHasUnsavedEditPreview = (state: RootState) =>
  state.documentViewerPage.editAiState === 'done' &&
  state.documentViewerPage.editPreviewContent !== null;

export default documentViewerPageSlice.reducer;
