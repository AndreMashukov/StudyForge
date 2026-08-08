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

export interface IBarChartDatum {
  name: string;
  minutes: number;
  directoryId: string;
}

export interface IStackedBarDatum {
  name: string;
  document: number;
  quiz: number;
  flashcardSet: number;
  slideDeck: number;
  diagramQuiz: number;
  sequenceQuiz: number;
}

export interface IDailyTrendDatum {
  date: string;
  minutes: number;
}

export interface IPieChartDatum {
  name: string;
  value: number;
  directoryId: string;
}
