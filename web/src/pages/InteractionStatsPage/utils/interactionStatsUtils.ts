import { ArtifactType, InteractionStat } from '@shared-types';
import { TimeframeKey, IDirectoryStatRow } from '../types/IInteractionStatsPage';

const ARTIFACT_LABELS: Record<ArtifactType, string> = {
  document: 'Documents',
  quiz: 'Quizzes',
  flashcardSet: 'Flashcards',
  slideDeck: 'Slide Decks',
  diagramQuiz: 'Diagram Quizzes',
  sequenceQuiz: 'Sequence Quizzes',
};

export function getArtifactLabel(type: ArtifactType): string {
  return ARTIFACT_LABELS[type];
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${Math.round(totalSeconds)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function getDateRange(timeframe: TimeframeKey): {
  startDate: string;
  endDate: string;
  label: string;
} {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);

  switch (timeframe) {
    case 'day':
      return { startDate: endDate, endDate, label: 'Today' };
    case 'week': {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 6);
      return {
        startDate: weekAgo.toISOString().slice(0, 10),
        endDate,
        label: 'Last 7 days',
      };
    }
    case 'month': {
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 29);
      return {
        startDate: monthAgo.toISOString().slice(0, 10),
        endDate,
        label: 'Last 30 days',
      };
    }
  }
}

/**
 * Aggregate stats by directory from the raw stat docs (which are per-directory-per-day).
 */
export function aggregateStatsByDirectory(
  stats: InteractionStat[],
  directoryNames: Record<string, string>
): IDirectoryStatRow[] {
  const map = new Map<string, IDirectoryStatRow>();

  for (const stat of stats) {
    const existing = map.get(stat.directoryId);
    if (existing) {
      existing.totalSeconds += stat.totalSeconds;
      existing.ownSeconds += stat.ownSeconds;
      existing.sessionCount += stat.sessionCount;
      for (const key of Object.keys(stat.byArtifactType) as ArtifactType[]) {
        existing.byArtifactType[key] =
          (existing.byArtifactType[key] || 0) + (stat.byArtifactType[key] || 0);
      }
    } else {
      map.set(stat.directoryId, {
        directoryId: stat.directoryId,
        directoryName: directoryNames[stat.directoryId] || 'Unknown',
        totalSeconds: stat.totalSeconds,
        ownSeconds: stat.ownSeconds,
        byArtifactType: { ...stat.byArtifactType },
        sessionCount: stat.sessionCount,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
}
