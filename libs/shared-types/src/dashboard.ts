import type { ArtifactType } from './index';

export interface ICompletedDashboardArtifact {
  id: string;
  artifactType: Exclude<ArtifactType, 'document'>;
  title: string;
  completedAt: string;
}

export interface ICompletedDashboardArtifactsResponse {
  artifacts: ICompletedDashboardArtifact[];
}
