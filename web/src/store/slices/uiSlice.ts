import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  isLoading: boolean;
  loadingMessage: string | null;
  toast: {
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  } | null;
  sidebar: {
    isOpen: boolean;
    openSections: string[];
    activeSection: string | null;
  };
}

const initialState: UIState = {
  isLoading: false,
  loadingMessage: null,
  toast: null,
  sidebar: {
    isOpen: true,
    openSections: [],
    activeSection: null,
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<{ isLoading: boolean; message?: string }>) => {
      state.isLoading = action.payload.isLoading;
      state.loadingMessage = action.payload.message || null;
    },
    showToast: (state, action: PayloadAction<{ message: string; type: 'success' | 'error' | 'info' }>) => {
      state.toast = {
        show: true,
        message: action.payload.message,
        type: action.payload.type,
      };
    },
    hideToast: (state) => {
      state.toast = null;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebar.isOpen = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebar.isOpen = !state.sidebar.isOpen;
    },
    setSidebarActiveSection: (state, action: PayloadAction<string | null>) => {
      state.sidebar.activeSection = action.payload;
    },
    toggleSidebarSection: (state, action: PayloadAction<string>) => {
      const sectionId = action.payload;
      if (state.sidebar.openSections.includes(sectionId)) {
        state.sidebar.openSections = state.sidebar.openSections.filter(id => id !== sectionId);
      } else {
        state.sidebar.openSections.push(sectionId);
      }
    },
    setSidebarOpenSections: (state, action: PayloadAction<string[]>) => {
      state.sidebar.openSections = action.payload;
    },
  },
});

export const { 
  setLoading, 
  showToast, 
  hideToast, 
  setSidebarOpen, 
  toggleSidebar, 
  setSidebarActiveSection, 
  toggleSidebarSection, 
  setSidebarOpenSections 
} = uiSlice.actions;

// Selectors
export const selectIsLoading = (state: { ui: UIState }) => state.ui.isLoading;
export const selectLoadingMessage = (state: { ui: UIState }) => state.ui.loadingMessage;
export const selectToast = (state: { ui: UIState }) => state.ui.toast;
export const selectSidebarIsOpen = (state: { ui: UIState }) => state.ui.sidebar.isOpen;
export const selectSidebarOpenSections = (state: { ui: UIState }) => state.ui.sidebar.openSections;
export const selectSidebarActiveSection = (state: { ui: UIState }) => state.ui.sidebar.activeSection;

export default uiSlice.reducer;