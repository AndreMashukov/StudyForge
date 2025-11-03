import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RuleApplicability, RuleColor } from '../../../../libs/shared-types/src';

interface RulesState {
  // Rule management
  selectedRuleId: string | null;
  isCreatingRule: boolean;
  isEditingRule: boolean;
  isDeletingRule: boolean;
  
  // Directory settings modal
  isDirectorySettingsOpen: boolean;
  selectedDirectoryId: string | null;
  
  // Rule selector state
  selectedRuleIds: string[]; // For current operation
  
  // Filters
  searchQuery: string;
  tagFilter: string[];
  applicabilityFilter: RuleApplicability | null;
  
  // UI state
  isAttachingRule: boolean;
  isDetachingRule: boolean;
  error: string | null;
}

const initialState: RulesState = {
  selectedRuleId: null,
  isCreatingRule: false,
  isEditingRule: false,
  isDeletingRule: false,
  isDirectorySettingsOpen: false,
  selectedDirectoryId: null,
  selectedRuleIds: [],
  searchQuery: '',
  tagFilter: [],
  applicabilityFilter: null,
  isAttachingRule: false,
  isDetachingRule: false,
  error: null,
};

const rulesSlice = createSlice({
  name: 'rules',
  initialState,
  reducers: {
    // Rule selection
    setSelectedRuleId: (state, action: PayloadAction<string | null>) => {
      state.selectedRuleId = action.payload;
    },
    
    // Rule CRUD states
    setIsCreatingRule: (state, action: PayloadAction<boolean>) => {
      state.isCreatingRule = action.payload;
    },
    setIsEditingRule: (state, action: PayloadAction<boolean>) => {
      state.isEditingRule = action.payload;
    },
    setIsDeletingRule: (state, action: PayloadAction<boolean>) => {
      state.isDeletingRule = action.payload;
    },
    
    // Directory settings modal
    openDirectorySettings: (state, action: PayloadAction<string>) => {
      state.isDirectorySettingsOpen = true;
      state.selectedDirectoryId = action.payload;
    },
    closeDirectorySettings: (state) => {
      state.isDirectorySettingsOpen = false;
      state.selectedDirectoryId = null;
    },
    
    // Rule selector for operations
    setSelectedRuleIds: (state, action: PayloadAction<string[]>) => {
      state.selectedRuleIds = action.payload;
    },
    toggleRuleSelection: (state, action: PayloadAction<string>) => {
      const ruleId = action.payload;
      const index = state.selectedRuleIds.indexOf(ruleId);
      
      if (index >= 0) {
        state.selectedRuleIds.splice(index, 1);
      } else {
        state.selectedRuleIds.push(ruleId);
      }
    },
    resetRuleSelection: (state, action: PayloadAction<string[]>) => {
      // Reset to default rules (passed as payload)
      state.selectedRuleIds = action.payload;
    },
    clearRuleSelection: (state) => {
      state.selectedRuleIds = [];
    },
    
    // Filters
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setTagFilter: (state, action: PayloadAction<string[]>) => {
      state.tagFilter = action.payload;
    },
    addTagFilter: (state, action: PayloadAction<string>) => {
      if (!state.tagFilter.includes(action.payload)) {
        state.tagFilter.push(action.payload);
      }
    },
    removeTagFilter: (state, action: PayloadAction<string>) => {
      state.tagFilter = state.tagFilter.filter(tag => tag !== action.payload);
    },
    setApplicabilityFilter: (state, action: PayloadAction<RuleApplicability | null>) => {
      state.applicabilityFilter = action.payload;
    },
    clearFilters: (state) => {
      state.searchQuery = '';
      state.tagFilter = [];
      state.applicabilityFilter = null;
    },
    
    // Directory-rule attachment
    setIsAttachingRule: (state, action: PayloadAction<boolean>) => {
      state.isAttachingRule = action.payload;
    },
    setIsDetachingRule: (state, action: PayloadAction<boolean>) => {
      state.isDetachingRule = action.payload;
    },
    
    // Error handling
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    
    // Reset
    resetRulesState: () => initialState,
  },
});

export const {
  setSelectedRuleId,
  setIsCreatingRule,
  setIsEditingRule,
  setIsDeletingRule,
  openDirectorySettings,
  closeDirectorySettings,
  setSelectedRuleIds,
  toggleRuleSelection,
  resetRuleSelection,
  clearRuleSelection,
  setSearchQuery,
  setTagFilter,
  addTagFilter,
  removeTagFilter,
  setApplicabilityFilter,
  clearFilters,
  setIsAttachingRule,
  setIsDetachingRule,
  setError,
  clearError,
  resetRulesState,
} = rulesSlice.actions;

// Selectors
export const selectSelectedRuleId = (state: { rules: RulesState }) => 
  state.rules.selectedRuleId;

export const selectIsCreatingRule = (state: { rules: RulesState }) => 
  state.rules.isCreatingRule;

export const selectIsEditingRule = (state: { rules: RulesState }) => 
  state.rules.isEditingRule;

export const selectIsDeletingRule = (state: { rules: RulesState }) => 
  state.rules.isDeletingRule;

export const selectIsDirectorySettingsOpen = (state: { rules: RulesState }) => 
  state.rules.isDirectorySettingsOpen;

export const selectSelectedDirectoryId = (state: { rules: RulesState }) => 
  state.rules.selectedDirectoryId;

export const selectSelectedRuleIds = (state: { rules: RulesState }) => 
  state.rules.selectedRuleIds;

export const selectSearchQuery = (state: { rules: RulesState }) => 
  state.rules.searchQuery;

export const selectTagFilter = (state: { rules: RulesState }) => 
  state.rules.tagFilter;

export const selectApplicabilityFilter = (state: { rules: RulesState }) => 
  state.rules.applicabilityFilter;

export const selectIsAttachingRule = (state: { rules: RulesState }) => 
  state.rules.isAttachingRule;

export const selectIsDetachingRule = (state: { rules: RulesState }) => 
  state.rules.isDetachingRule;

export const selectRulesError = (state: { rules: RulesState }) => 
  state.rules.error;

export default rulesSlice.reducer;
