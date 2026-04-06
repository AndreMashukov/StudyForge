import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ArtifactPanelType = 'quizzes' | 'cards' | 'slides' | 'diagramQuizzes' | 'sequenceQuizzes';

interface PendingGeneration {
  directoryId: string;
  artifactType: ArtifactPanelType;
}

interface ArtifactGenerationState {
  pendingGenerations: PendingGeneration[];
}

const initialState: ArtifactGenerationState = {
  pendingGenerations: [],
};

const artifactGenerationSlice = createSlice({
  name: 'artifactGeneration',
  initialState,
  reducers: {
    addPendingGeneration: (state, action: PayloadAction<PendingGeneration>) => {
      state.pendingGenerations.push(action.payload);
    },
    removePendingGeneration: (state, action: PayloadAction<PendingGeneration>) => {
      state.pendingGenerations = state.pendingGenerations.filter(
        (g) =>
          !(g.directoryId === action.payload.directoryId && g.artifactType === action.payload.artifactType)
      );
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
