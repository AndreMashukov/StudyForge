import type { ArtifactType, ICompletedDashboardArtifact } from '@shared-types';

export interface IDashboardDateRange {
  startDate: string;
  endDate: string;
  dayCount: number;
}

export interface IActivityHeatmapDay {
  date: string;
  hasActivity: boolean;
  materialTypes: ArtifactType[];
}

export interface IGenerationBucket {
  id: string;
  label: string;
  artifacts: ICompletedDashboardArtifact[];
}
