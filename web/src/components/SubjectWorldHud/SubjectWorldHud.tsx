import React from 'react';
import { SubjectWorldQuest, SubjectWorldProgressSnapshot } from '@shared-types';
import {
  getQuestProgress,
  isQuestComplete,
} from '../../store/slices/subjectWorldPageSlice';
import { ISceneMarker } from '../../pages/SubjectWorldPage/utils/subjectWorldSceneAdapter';
import { cn } from '../../lib/utils';

interface ISubjectWorldHudProps {
  title: string;
  quests: SubjectWorldQuest[];
  progress: SubjectWorldProgressSnapshot;
  nearMarker: ISceneMarker | null;
  isWorldComplete?: boolean;
}

export const SubjectWorldHud: React.FC<ISubjectWorldHudProps> = ({
  title,
  quests,
  progress,
  nearMarker,
  isWorldComplete = false,
}) => {
  const visitedCount = progress.visitedPoiIds.length;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-4">
      <div className="mx-auto w-full max-w-4xl rounded-lg border border-border/60 bg-background/80 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          WASD to move · Click canvas to capture mouse · Press E or click markers to interact
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          POIs visited: {visitedCount}
          {nearMarker ? ` · Near: ${nearMarker.label}` : ''}
        </p>
        {isWorldComplete && (
          <p className="mt-2 text-sm font-medium text-accent">All quests complete — world mastered!</p>
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
