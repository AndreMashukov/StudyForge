import React from 'react';
import { SubjectWorldQuest, SubjectWorldProgressSnapshot } from '@shared-types';
import { isQuestComplete } from '../../store/slices/subjectWorldPageSlice';
import { ISceneMarker } from '../../pages/SubjectWorldPage/utils/subjectWorldSceneAdapter';

interface ISubjectWorldHudProps {
  title: string;
  quests: SubjectWorldQuest[];
  progress: SubjectWorldProgressSnapshot;
  nearMarker: ISceneMarker | null;
}

export const SubjectWorldHud: React.FC<ISubjectWorldHudProps> = ({
  title,
  quests,
  progress,
  nearMarker,
}) => {
  const visitedCount = progress.visitedPoiIds.length;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-4">
      <div className="mx-auto w-full max-w-4xl rounded-lg border border-border/60 bg-background/80 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          WASD to move · Click canvas to capture mouse · Press E near markers to interact
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          POIs visited: {visitedCount}
          {nearMarker ? ` · Near: ${nearMarker.label}` : ''}
        </p>
      </div>
      {quests.length > 0 && (
        <div className="mx-auto w-full max-w-sm rounded-lg border border-border/60 bg-background/80 p-3 backdrop-blur">
          <p className="mb-2 text-sm font-medium">Quests</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {quests.map((quest) => {
              const done = isQuestComplete(quest, progress) || progress.completedQuestIds.includes(quest.id);
              return (
                <li key={quest.id} className={done ? 'text-accent' : undefined}>
                  {done ? '✓ ' : '○ '}{quest.title}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
