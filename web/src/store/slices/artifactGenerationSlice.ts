import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ArtifactPanelType = 'quizzes' | 'cards' | 'slides' | 'diagramQuizzes' | 'sequenceQuizzes' | 'matchQuizzes' | 'sources';

export interface IPendingGeneration {
  id: string;
  directoryId: string;
  artifactType: ArtifactPanelType;
  optimisticTitle?: string;
}

interface ArtifactGenerationState {
  pendingGenerations: IPendingGeneration[];
}

const initialState: ArtifactGenerationState = {
  pendingGenerations: [],
};

const artifactGenerationSlice = createSlice({
  name: 'artifactGeneration',
  initialState,
  reducers: {
    addPendingGeneration: (state, action: PayloadAction<IPendingGeneration>) => {
      state.pendingGenerations.push(action.payload);
    },
    removePendingGeneration: (state, action: PayloadAction<{ id: string }>) => {
      const idx = state.pendingGenerations.findIndex(
        (g) => g.id === action.payload.id,
      );
      if (idx !== -1) {
        state.pendingGenerations.splice(idx, 1);
      }
    },
  },
});

export const { addPendingGeneration, removePendingGeneration } = artifactGenerationSlice.actions;

interface StateWithArtifactGeneration {
  artifactGeneration: ArtifactGenerationState;
}

export const selectPendingGenerations = (state: StateWithArtifactGeneration) =>
  state.artifactGeneration.pendingGenerations;

export const selectIsGeneratingArtifact = (
  state: StateWithArtifactGeneration,
  directoryId: string,
  artifactType: ArtifactPanelType
) =>
  state.artifactGeneration.pendingGenerations.some(
    (g) => g.directoryId === directoryId && g.artifactType === artifactType
  );

export default artifactGenerationSlice.reducer;
