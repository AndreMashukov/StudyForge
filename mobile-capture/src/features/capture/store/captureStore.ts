import { create } from 'zustand';
import { CaptureState } from '../types/ICapture';

export interface IPendingScan {
  imageUri: string;
  ocrText: string;
  directoryId: string;
}

interface ICaptureStore {
  captureState: CaptureState;
  statusMessage: string | null;
  pendingScan: IPendingScan | null;
  lastDocumentId: string | null;
  lastTitle: string | null;
  setCaptureState: (state: CaptureState) => void;
  setStatusMessage: (message: string | null) => void;
  setPendingScan: (scan: IPendingScan | null) => void;
  setLastResult: (documentId: string, title: string) => void;
  resetStatus: () => void;
}

export const useCaptureStore = create<ICaptureStore>((set) => ({
  captureState: 'idle',
  statusMessage: null,
  pendingScan: null,
  lastDocumentId: null,
  lastTitle: null,
  setCaptureState: (captureState) => set({ captureState }),
  setStatusMessage: (statusMessage) => set({ statusMessage }),
  setPendingScan: (pendingScan) => set({ pendingScan }),
  setLastResult: (lastDocumentId, lastTitle) => set({ lastDocumentId, lastTitle }),
  resetStatus: () => set({ statusMessage: null }),
}));
