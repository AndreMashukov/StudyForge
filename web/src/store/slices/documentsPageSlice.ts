import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface DocumentsPageState {
  searchQuery: string;
  selectedDocumentId: string | null;
  isCreatingQuiz: boolean;
  isDeletingDocument: boolean;
  error: string | null;
}

const initialState: DocumentsPageState = {
  searchQuery: '',
  selectedDocumentId: null,
  isCreatingQuiz: false,
  isDeletingDocument: false,
  error: null,
};

const documentsPageSlice = createSlice({
  name: 'documentsPage',
  initialState,
  reducers: {
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setSelectedDocumentId: (state, action: PayloadAction<string | null>) => {
      state.selectedDocumentId = action.payload;
    },
    setIsCreatingQuiz: (state, action: PayloadAction<boolean>) => {
      state.isCreatingQuiz = action.payload;
    },
    setIsDeletingDocument: (state, action: PayloadAction<boolean>) => {
      state.isDeletingDocument = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    resetDocumentsPage: (state) => {
      return initialState;
    },
  },
});

export const {
  setSearchQuery,
  setSelectedDocumentId,
  setIsCreatingQuiz,
  setIsDeletingDocument,
  setError,
  clearError,
  resetDocumentsPage,
} = documentsPageSlice.actions;

// Selectors
export const selectSearchQuery = (state: { documentsPage: DocumentsPageState }) => 
  state.documentsPage.searchQuery;
export const selectSelectedDocumentId = (state: { documentsPage: DocumentsPageState }) => 
  state.documentsPage.selectedDocumentId;
export const selectIsCreatingQuiz = (state: { documentsPage: DocumentsPageState }) => 
  state.documentsPage.isCreatingQuiz;
export const selectIsDeletingDocument = (state: { documentsPage: DocumentsPageState }) => 
  state.documentsPage.isDeletingDocument;
export const selectDocumentsPageError = (state: { documentsPage: DocumentsPageState }) => 
  state.documentsPage.error;

export default documentsPageSlice.reducer;