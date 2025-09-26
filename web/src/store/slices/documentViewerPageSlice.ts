import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../index';
import { TocItem } from '../../components/MarkdownRenderer';

interface DocumentViewerPageState {
  tocItems: TocItem[];
  showToc: boolean;
  isExporting: boolean;
}

const initialState: DocumentViewerPageState = {
  tocItems: [],
  showToc: false,
  isExporting: false,
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
  },
});

export const {
  setTocItems,
  setShowToc,
  toggleToc,
  setIsExporting,
} = documentViewerPageSlice.actions;

// Selectors
export const selectTocItems = (state: RootState) => state.documentViewerPage.tocItems;
export const selectShowToc = (state: RootState) => state.documentViewerPage.showToc;
export const selectIsExporting = (state: RootState) => state.documentViewerPage.isExporting;

export default documentViewerPageSlice.reducer;