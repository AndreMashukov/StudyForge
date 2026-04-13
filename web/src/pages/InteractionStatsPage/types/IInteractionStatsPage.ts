import { ArtifactType } from '@shared-types';

export type TimeframeKey = 'day' | 'week' | 'month';

export interface IDirectoryStatRow {
  directoryId: string;
  directoryName: string;
  totalSeconds: number;
  ownSeconds: number;
  byArtifactType: Record<ArtifactType, number>;
  sessionCount: number;
}
