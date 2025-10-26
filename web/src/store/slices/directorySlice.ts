import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../index';

interface DirectoryState {
  selectedDirectoryId: string | null;
  expandedDirectoryIds: string[];
  currentPath: string[];
  viewMode: 'list' | 'grid';
  showHidden: boolean;
  sortBy: 'name' | 'date' | 'size';
  sortOrder: 'asc' | 'desc';
}

const initialState: DirectoryState = {
  selectedDirectoryId: null,
  expandedDirectoryIds: [],
  currentPath: [],
  viewMode: 'list',
  showHidden: false,
  sortBy: 'name',
  sortOrder: 'asc',
};

const directorySlice = createSlice({
  name: 'directory',
  initialState,
  reducers: {
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
    
    resetDirectoryState: () => initialState,
  },
});

export const {
  setSelectedDirectory,
  toggleExpandDirectory,
  expandDirectory,
  collapseDirectory,
  expandAll,
  collapseAll,
  setCurrentPath,
  setViewMode,
  toggleShowHidden,
  setSortBy,
  setSortOrder,
  toggleSortOrder,
  resetDirectoryState,
} = directorySlice.actions;

// Selectors
export const selectSelectedDirectoryId = (state: RootState) => state.directory.selectedDirectoryId;
export const selectExpandedDirectoryIds = (state: RootState) => state.directory.expandedDirectoryIds;
export const selectCurrentPath = (state: RootState) => state.directory.currentPath;
export const selectViewMode = (state: RootState) => state.directory.viewMode;
export const selectShowHidden = (state: RootState) => state.directory.showHidden;
export const selectSortBy = (state: RootState) => state.directory.sortBy;
export const selectSortOrder = (state: RootState) => state.directory.sortOrder;
export const selectIsDirectoryExpanded = (directoryId: string) => (state: RootState) =>
  state.directory.expandedDirectoryIds.includes(directoryId);

export default directorySlice.reducer;
