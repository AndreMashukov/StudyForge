import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DirectoryChatArtifactContext } from '@shared-types';

export interface IDirectoryChatPendingSeed {
  directoryId: string;
  seedKey: string;
  seedMessage: string;
  artifactContext?: DirectoryChatArtifactContext;
}

interface IDirectoryChatState {
  pendingSeed: IDirectoryChatPendingSeed | null;
}

const initialState: IDirectoryChatState = {
  pendingSeed: null,
};

const directoryChatSlice = createSlice({
  name: 'directoryChat',
  initialState,
  reducers: {
    setPendingDirectoryChatSeed: (
      state,
      action: PayloadAction<IDirectoryChatPendingSeed>,
    ) => {
      state.pendingSeed = action.payload;
    },
    clearPendingDirectoryChatSeed: (state) => {
      state.pendingSeed = null;
    },
  },
});

export const { setPendingDirectoryChatSeed, clearPendingDirectoryChatSeed } =
  directoryChatSlice.actions;

export const selectPendingDirectoryChatSeed = (state: {
  directoryChat: IDirectoryChatState;
}) => state.directoryChat.pendingSeed;

export default directoryChatSlice.reducer;
