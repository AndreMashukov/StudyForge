import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  isLoading: boolean;
  loadingMessage: string | null;
  toast: {
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  } | null;
}

const initialState: UIState = {
  isLoading: false,
  loadingMessage: null,
  toast: null,
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
  },
});

export const { setLoading, showToast, hideToast } = uiSlice.actions;
export default uiSlice.reducer;