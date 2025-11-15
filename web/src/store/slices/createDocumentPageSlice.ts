import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IAttachedFile } from '../../types/fileUpload';

export type SourceType = 'website' | 'file' | 'textPrompt' | 'videoUrl';

export interface ICreateDocumentPageState {
  selectedSource: SourceType | null;
  isFormVisible: boolean;
  isAnimating: boolean;
  error: string | null;
  directoryId: string | null; // 🆕 Directory to place new document in
  
  // Rule selection state (Section 6)
  selectedRuleIds: {
    scraping: string[];
    upload: string[];
    prompt: string[];
  };
  
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
    selectedDocumentIds: string[]; // Track library document selections
    documentSelectorLoading: boolean; // Loading state for fetching library documents
  };
}

const initialState: ICreateDocumentPageState = {
  selectedSource: null,
  isFormVisible: false,
  isAnimating: false,
  error: null,
  directoryId: null, // 🆕 Initialize directoryId
  selectedRuleIds: {
    scraping: [],
    upload: [],
    prompt: [],
  },
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
    selectedDocumentIds: [],
    documentSelectorLoading: false,
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
      state.textPromptForm.selectedDocumentIds = [];
    },
    setContextSizeError: (state, action: PayloadAction<string | null>) => {
      state.textPromptForm.contextSizeError = action.payload;
    },
    // Document selector actions
    toggleDocumentSelection: (state, action: PayloadAction<string>) => {
      const documentId = action.payload;
      const index = state.textPromptForm.selectedDocumentIds.indexOf(documentId);
      
      if (index > -1) {
        // Remove from selection
        state.textPromptForm.selectedDocumentIds.splice(index, 1);
      } else {
        // Add to selection (if under limit)
        if (state.textPromptForm.attachedFiles.length < 5) {
          state.textPromptForm.selectedDocumentIds.push(documentId);
        }
      }
    },
    setDocumentSelectorLoading: (state, action: PayloadAction<boolean>) => {
      state.textPromptForm.documentSelectorLoading = action.payload;
    },
    clearDocumentSelections: (state) => {
      state.textPromptForm.selectedDocumentIds = [];
      // Remove library documents from attachedFiles
      state.textPromptForm.attachedFiles = state.textPromptForm.attachedFiles.filter(
        file => file.source !== 'library'
      );
      // Recalculate total context size
      state.textPromptForm.totalContextSize = state.textPromptForm.attachedFiles.reduce(
        (sum, file) => sum + file.characterCount,
        0
      );
    },
    clearSelection: (state) => {
      state.selectedSource = null;
      state.isFormVisible = false;
      state.isAnimating = false;
    },
    setDirectoryId: (state, action: PayloadAction<string | null>) => {
      state.directoryId = action.payload;
    },
    // Rule selection actions (Section 6)
    setScrapingRules: (state, action: PayloadAction<string[]>) => {
      state.selectedRuleIds.scraping = action.payload;
    },
    setUploadRules: (state, action: PayloadAction<string[]>) => {
      state.selectedRuleIds.upload = action.payload;
    },
    setPromptRules: (state, action: PayloadAction<string[]>) => {
      state.selectedRuleIds.prompt = action.payload;
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
  toggleDocumentSelection,
  setDocumentSelectorLoading,
  clearDocumentSelections,
  clearSelection,
  setDirectoryId,
  setScrapingRules,
  setUploadRules,
  setPromptRules,
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
export const selectDirectoryId = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.directoryId;
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

// Document selector selectors
export const selectSelectedDocumentIds = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.textPromptForm.selectedDocumentIds;
export const selectDocumentSelectorLoading = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.textPromptForm.documentSelectorLoading;
export const selectCanSelectMoreDocuments = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.textPromptForm.attachedFiles.length < 5;
export const selectUploadedFilesCount = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.textPromptForm.attachedFiles.filter(f => f.source === 'upload').length;
export const selectLibraryDocumentsCount = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.textPromptForm.attachedFiles.filter(f => f.source === 'library').length;

// Rule selection selectors (Section 6)
export const selectScrapingRules = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.selectedRuleIds.scraping;
export const selectUploadRules = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.selectedRuleIds.upload;
export const selectPromptRules = (state: { createDocumentPage: ICreateDocumentPageState }) => 
  state.createDocumentPage.selectedRuleIds.prompt;

export default createDocumentPageSlice.reducer;