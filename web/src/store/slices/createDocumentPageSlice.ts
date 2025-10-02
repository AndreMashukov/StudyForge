import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type SourceType = 'website' | 'file' | 'textPrompt' | 'videoUrl';

export interface ICreateDocumentPageState {
  selectedSource: SourceType | null;
  isFormVisible: boolean;
  isAnimating: boolean;
  error: string | null;
  
  // Form-specific states
  urlForm: {
    isLoading: boolean;
  };
  fileForm: {
    isLoading: boolean;
  };
  textPromptForm: {
    isLoading: boolean;
    progress: number; // 0-100 for progress indication
  };
}

const initialState: ICreateDocumentPageState = {
  selectedSource: null,
  isFormVisible: false,
  isAnimating: false,
  error: null,
  urlForm: {
    isLoading: false,
  },
  fileForm: {
    isLoading: false,
  },
  textPromptForm: {
    isLoading: false,
    progress: 0,
  },
};

const createDocumentPageSlice = createSlice({
  name: 'createDocumentPage',
  initialState,
  reducers: {
    setSelectedSource: (state, action: PayloadAction<SourceType | null>) => {
      state.selectedSource = action.payload;
      state.isFormVisible = action.payload !== null;
      if (action.payload === null) {
        state.isAnimating = false;
      }
    },
    setIsFormVisible: (state, action: PayloadAction<boolean>) => {
      state.isFormVisible = action.payload;
    },
    setIsAnimating: (state, action: PayloadAction<boolean>) => {
      state.isAnimating = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    setUrlFormLoading: (state, action: PayloadAction<boolean>) => {
      state.urlForm.isLoading = action.payload;
    },
    setFileFormLoading: (state, action: PayloadAction<boolean>) => {
      state.fileForm.isLoading = action.payload;
    },
    setTextPromptFormLoading: (state, action: PayloadAction<boolean>) => {
      state.textPromptForm.isLoading = action.payload;
    },
    setTextPromptFormProgress: (state, action: PayloadAction<number>) => {
      state.textPromptForm.progress = action.payload;
    },
    clearSelection: (state) => {
      state.selectedSource = null;
      state.isFormVisible = false;
      state.isAnimating = false;
    },
    resetCreateDocumentPage: (state) => {
      return initialState;
    },
  },
});

export const {
  setSelectedSource,
  setIsFormVisible,
  setIsAnimating,
  setError,
  clearError,
  setUrlFormLoading,
  setFileFormLoading,
  setTextPromptFormLoading,
  setTextPromptFormProgress,
  clearSelection,
  resetCreateDocumentPage,
} = createDocumentPageSlice.actions;

// Selectors
export const selectSelectedSource = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.selectedSource;
export const selectIsFormVisible = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.isFormVisible;
export const selectIsAnimating = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.isAnimating;
export const selectCreateDocumentPageError = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.error;
export const selectUrlFormLoading = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.urlForm.isLoading;
export const selectFileFormLoading = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.fileForm.isLoading;
export const selectTextPromptFormLoading = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.textPromptForm.isLoading;
export const selectTextPromptFormProgress = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.textPromptForm.progress;

export default createDocumentPageSlice.reducer;