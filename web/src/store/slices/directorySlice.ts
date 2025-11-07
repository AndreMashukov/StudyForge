import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../index';

interface DirectoryState {
  // Directory navigation
  selectedDirectoryId: string | null;
  expandedDirectoryIds: string[];
  currentPath: string[];
  
  // Document selection and search
  selectedDocumentId: string | null;
  searchQuery: string;
  
  // UI preferences
  viewMode: 'list' | 'grid';
  showHidden: boolean;
  sortBy: 'name' | 'date' | 'size';
  sortOrder: 'asc' | 'desc';
  
  // Operation states
  isCreatingQuiz: boolean;
  isDeletingDocument: boolean;
  error: string | null;
}

const initialState: DirectoryState = {
  // Directory navigation
  selectedDirectoryId: null,
  expandedDirectoryIds: [],
  currentPath: [],
  
  // Document selection and search
  selectedDocumentId: null,
  searchQuery: '',
  
  // UI preferences
  viewMode: 'list',
  showHidden: false,
  sortBy: 'name',
  sortOrder: 'asc',
  
  // Operation states
  isCreatingQuiz: false,
  isDeletingDocument: false,
  error: null,
};

const directorySlice = createSlice({
  name: 'directory',
  initialState,
  reducers: {
    // Directory navigation actions
    setSelectedDirectory: (state, action: PayloadAction<string | null>) => {
      state.selectedDirectoryId = action.payload;
    },
    
    toggleExpandDirectory: (state, action: PayloadAction<string>) => {
      const directoryId = action.payload;
      const index = state.expandedDirectoryIds.indexOf(directoryId);
      
      if (index > -1) {
        state.expandedDirectoryIds.splice(index, 1);
      } else {
        state.expandedDirectoryIds.push(directoryId);
      }
    },
    
    expandDirectory: (state, action: PayloadAction<string>) => {
      const directoryId = action.payload;
      if (!state.expandedDirectoryIds.includes(directoryId)) {
        state.expandedDirectoryIds.push(directoryId);
      }
    },
    
    collapseDirectory: (state, action: PayloadAction<string>) => {
      const directoryId = action.payload;
      const index = state.expandedDirectoryIds.indexOf(directoryId);
      if (index > -1) {
        state.expandedDirectoryIds.splice(index, 1);
      }
    },
    
    expandAll: (state, action: PayloadAction<string[]>) => {
      state.expandedDirectoryIds = action.payload;
    },
    
    collapseAll: (state) => {
      state.expandedDirectoryIds = [];
    },
    
    setCurrentPath: (state, action: PayloadAction<string[]>) => {
      state.currentPath = action.payload;
    },
    
    // Document actions
    setSelectedDocument: (state, action: PayloadAction<string | null>) => {
      state.selectedDocumentId = action.payload;
    },
    
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    
    // UI preference actions
    setViewMode: (state, action: PayloadAction<'list' | 'grid'>) => {
      state.viewMode = action.payload;
    },
    
    toggleShowHidden: (state) => {
      state.showHidden = !state.showHidden;
    },
    
    setSortBy: (state, action: PayloadAction<'name' | 'date' | 'size'>) => {
      state.sortBy = action.payload;
    },
    
    setSortOrder: (state, action: PayloadAction<'asc' | 'desc'>) => {
      state.sortOrder = action.payload;
    },
    
    toggleSortOrder: (state) => {
      state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
    },
    
    // Operation state actions
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
    
    resetDirectoryState: () => initialState,
  },
});

export const {
  // Directory navigation
  setSelectedDirectory,
  toggleExpandDirectory,
  expandDirectory,
  collapseDirectory,
  expandAll,
  collapseAll,
  setCurrentPath,
  
  // Document actions
  setSelectedDocument,
  setSearchQuery,
  
  // UI preferences
  setViewMode,
  toggleShowHidden,
  setSortBy,
  setSortOrder,
  toggleSortOrder,
  
  // Operation states
  setIsCreatingQuiz,
  setIsDeletingDocument,
  setError,
  clearError,
  
  resetDirectoryState,
} = directorySlice.actions;

// Selectors - Directory navigation
export const selectSelectedDirectoryId = (state: RootState) => state.directory.selectedDirectoryId;
export const selectExpandedDirectoryIds = (state: RootState) => state.directory.expandedDirectoryIds;
export const selectCurrentPath = (state: RootState) => state.directory.currentPath;
export const selectIsDirectoryExpanded = (directoryId: string) => (state: RootState) =>
  state.directory.expandedDirectoryIds.includes(directoryId);

// Selectors - Document
export const selectSelectedDocumentId = (state: RootState) => state.directory.selectedDocumentId;
export const selectSearchQuery = (state: RootState) => state.directory.searchQuery;

// Selectors - UI preferences
export const selectViewMode = (state: RootState) => state.directory.viewMode;
export const selectShowHidden = (state: RootState) => state.directory.showHidden;
export const selectSortBy = (state: RootState) => state.directory.sortBy;
export const selectSortOrder = (state: RootState) => state.directory.sortOrder;

// Selectors - Operation states
export const selectIsCreatingQuiz = (state: RootState) => state.directory.isCreatingQuiz;
export const selectIsDeletingDocument = (state: RootState) => state.directory.isDeletingDocument;
export const selectError = (state: RootState) => state.directory.error;

export default directorySlice.reducer;
