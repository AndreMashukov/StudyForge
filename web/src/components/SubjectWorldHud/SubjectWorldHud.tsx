import React from 'react';
import { SubjectWorldPoi, SubjectWorldQuest, SubjectWorldProgressSnapshot, SubjectWorldTheme } from '@shared-types';
import {
  getQuestProgress,
  isQuestComplete,
} from '../../store/slices/subjectWorldPageSlice';
import { ISceneMarker } from '../../pages/SubjectWorldPage/utils/subjectWorldSceneAdapter';
import { cn } from '../../lib/utils';

interface ISubjectWorldHudProps {
  title: string;
  quests: SubjectWorldQuest[];
  pois: SubjectWorldPoi[];
  progress: SubjectWorldProgressSnapshot;
  nearMarker: ISceneMarker | null;
  isWorldComplete?: boolean;
  theme?: SubjectWorldTheme;
  accessibleZoneCount?: number;
  totalZoneCount?: number;
}

const THEME_LABELS: Record<SubjectWorldTheme, string> = {
  voxel: 'Voxel',
  museum: 'Museum',
  outdoor: 'Outdoor',
  lab: 'Lab',
  space: 'Space',
};

export const SubjectWorldHud: React.FC<ISubjectWorldHudProps> = ({
  title,
  quests,
  pois,
  progress,
  nearMarker,
  isWorldComplete = false,
  theme = 'voxel',
  accessibleZoneCount,
  totalZoneCount,
}) => {
  const visitedCount = progress.visitedPoiIds.length;
  const collectedPois = pois.filter((poi) => progress.collectedConceptIds.includes(poi.id));

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-4">
      <div className="mx-auto w-full max-w-4xl rounded-lg border border-border/60 bg-background/80 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          WASD to move · Click canvas to capture mouse · Press E or click markers to interact
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Theme: {THEME_LABELS[theme]}
          {totalZoneCount && totalZoneCount > 1 && accessibleZoneCount !== undefined
            ? ` · Zones unlocked: ${accessibleZoneCount}/${totalZoneCount}`
            : ''}
          {' · '}POIs visited: {visitedCount}
          {nearMarker ? ` · Near: ${nearMarker.label}` : ''}
        </p>
        {isWorldComplete && (
          <p className="mt-2 text-sm font-medium text-accent">All quests complete — world mastered!</p>
        )}
        {collectedPois.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Inventory</p>
            <div className="flex flex-wrap gap-1.5">
              {collectedPois.map((poi) => (
                <span
                  key={poi.id}
                  className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-200"
                >
                  {poi.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      {quests.length > 0 && (
        <div className="mx-auto w-full max-w-sm rounded-lg border border-border/60 bg-background/80 p-3 backdrop-blur">
          <p className="mb-2 text-sm font-medium">Quests</p>
          <ul className="space-y-2 text-xs">
            {quests.map((quest) => {
              const done =
                isQuestComplete(quest, progress) ||
                progress.completedQuestIds.includes(quest.id);
              const { completed, total } = getQuestProgress(quest, progress);
              const percent = total > 0 ? Math.round((completed / total) * 100) : done ? 100 : 0;

              return (
                <li key={quest.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('truncate', done ? 'text-accent' : 'text-muted-foreground')}>
                      {quest.title}
                    </span>
                    <span className={cn('shrink-0 tabular-nums', done ? 'text-accent' : 'text-muted-foreground')}>
                      {completed}/{total}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full transition-all', done ? 'bg-accent' : 'bg-primary')}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
