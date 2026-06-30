import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Box } from 'lucide-react';
import { ArtifactSummary } from '@shared-types';
import { Button } from '../../components/ui/Button';
import { ArtifactRow, ArtifactRowGenerating } from './ArtifactRow';
import { useOptimisticGeneratingRow } from './hooks/useOptimisticGeneratingRow';
import { useAppDispatch } from '../../hooks/redux';
import { subjectWorldApi } from '../../store/api/SubjectWorld/SubjectWorldApi';

interface ISubjectWorldsPanelProps {
  subjectWorlds: ArtifactSummary[];
  directoryId: string;
  mayBeTruncated?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'subjectWorld' }) => void;
  ruleNamesMap?: Map<string, string>;
}

export const SubjectWorldsPanel: React.FC<ISubjectWorldsPanelProps> = ({
  subjectWorlds,
  directoryId,
  mayBeTruncated = false,
  onDeleteArtifact,
  ruleNamesMap,
}) => {
  const dispatch = useAppDispatch();
  const prefetchSubjectWorld = useCallback(
    (subjectWorldId: string) => {
      dispatch(
        subjectWorldApi.util.prefetch('getSubjectWorld', { subjectWorldId }, { force: false }),
      );
    },
    [dispatch],
  );

  const completedCount = subjectWorlds.filter(
    (sw) => !sw.generationStatus || sw.generationStatus === 'completed'
  ).length;
  const { showOptimisticRow, optimisticTitle } = useOptimisticGeneratingRow(
    directoryId,
    'subjectWorlds',
    subjectWorlds,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Subject worlds ({completedCount})</h2>
        <Button size="sm" asChild>
          <Link to={`/subject-world/create?directoryId=${encodeURIComponent(directoryId)}`}>+ Create subject world</Link>
        </Button>
      </div>
      {mayBeTruncated && (
        <div className="flex items-center gap-2 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-sm text-primary">
          <AlertTriangle size={16} className="shrink-0" />
          <span>Showing first {subjectWorlds.length} subject worlds — more may exist.</span>
        </div>
      )}
      {subjectWorlds.length === 0 && !showOptimisticRow ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No subject worlds in this directory yet.
        </div>
      ) : (
        <div className="space-y-2">
          {showOptimisticRow && <ArtifactRowGenerating title={optimisticTitle} />}
          {subjectWorlds.map((sw) => (
            <ArtifactRow
              key={sw.id}
              icon={Box}
              title={sw.title}
              createdAt={sw.createdAt}
              linkTo={`/subject-world/${sw.id}?directoryId=${encodeURIComponent(directoryId)}`}
              onDelete={() =>
                onDeleteArtifact({ id: sw.id, title: sw.title, type: 'subjectWorld' })
              }
              deleteAriaLabel={`Delete ${sw.title}`}
              appliedRuleNames={sw.appliedRuleIds?.map((id) => ruleNamesMap?.get(id) ?? 'Unknown rule')}
              completedAt={sw.completedAt}
              generationModel={sw.generationModel}
              generationStatus={sw.generationStatus}
              generationError={sw.generationError}
              documentColor={sw.documentColor}
              documentColors={sw.documentColors}
              onLinkHover={() => prefetchSubjectWorld(sw.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
