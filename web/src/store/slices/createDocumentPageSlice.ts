import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IAttachedFile } from '../../types/fileUpload';

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
    attachedFiles: IAttachedFile[];
    totalContextSize: number; // Total characters across all files
    contextSizeError: string | null;
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
    attachedFiles: [],
    totalContextSize: 0,
    contextSizeError: null,
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
    // File attachment actions
    addFile: (state, action: PayloadAction<IAttachedFile>) => {
      state.textPromptForm.attachedFiles.push(action.payload);
      // Recalculate total context size
      state.textPromptForm.totalContextSize = state.textPromptForm.attachedFiles.reduce(
        (sum, file) => sum + file.characterCount,
        0
      );
    },
    removeFile: (state, action: PayloadAction<string>) => {
      state.textPromptForm.attachedFiles = state.textPromptForm.attachedFiles.filter(
        file => file.id !== action.payload
      );
      // Recalculate total context size
      state.textPromptForm.totalContextSize = state.textPromptForm.attachedFiles.reduce(
        (sum, file) => sum + file.characterCount,
        0
      );
      // Clear context size error if files are removed
      if (state.textPromptForm.attachedFiles.length === 0) {
        state.textPromptForm.contextSizeError = null;
      }
    },
    updateFileStatus: (
      state,
      action: PayloadAction<{ id: string; status: IAttachedFile['status']; error?: string }>
    ) => {
      const file = state.textPromptForm.attachedFiles.find(f => f.id === action.payload.id);
      if (file) {
        file.status = action.payload.status;
        if (action.payload.error) {
          file.error = action.payload.error;
        }
      }
    },
    clearFiles: (state) => {
      state.textPromptForm.attachedFiles = [];
      state.textPromptForm.totalContextSize = 0;
      state.textPromptForm.contextSizeError = null;
    },
    setContextSizeError: (state, action: PayloadAction<string | null>) => {
      state.textPromptForm.contextSizeError = action.payload;
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
  addFile,
  removeFile,
  updateFileStatus,
  clearFiles,
  setContextSizeError,
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

// File attachment selectors
export const selectAttachedFiles = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.textPromptForm.attachedFiles;
export const selectTotalContextSize = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.textPromptForm.totalContextSize;
export const selectContextSizeError = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.textPromptForm.contextSizeError;
export const selectCanAttachMore = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.textPromptForm.attachedFiles.length < 5;
export const selectAttachedFilesCount = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.textPromptForm.attachedFiles.length;

export default createDocumentPageSlice.reducer;