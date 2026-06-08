import { ISceneMarker } from '../utils/subjectWorldSceneAdapter';

export interface ISubjectWorldPageHandlers {
  handleBackToDirectory: () => void;
  handleNearMarkerChange: (marker: ISceneMarker | null) => void;
  handleInteract: () => void;
  handleInteractMarker: (marker: ISceneMarker) => void;
  handleClosePanel: () => void;
  handleSelectGateAnswer: (index: number) => void;
  handleSubmitGateAnswer: () => void;
}
