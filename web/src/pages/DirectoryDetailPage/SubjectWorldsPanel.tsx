import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Box } from 'lucide-react';
import { ArtifactSummary } from '@shared-types';
import { Button } from '../../components/ui/Button';
import { ArtifactRow } from './ArtifactRow';

interface SubjectWorldsPanelProps {
  subjectWorlds: ArtifactSummary[];
  directoryId: string;
  mayBeTruncated?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'subjectWorld' }) => void;
  ruleNamesMap?: Map<string, string>;
}

export const SubjectWorldsPanel: React.FC<SubjectWorldsPanelProps> = ({
  subjectWorlds,
  directoryId,
  mayBeTruncated = false,
  onDeleteArtifact,
  ruleNamesMap,
}) => {
  const completedCount = subjectWorlds.filter(
    (sw) => !sw.generationStatus || sw.generationStatus === 'completed'
  ).length;

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
      {subjectWorlds.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No subject worlds in this directory yet.
        </div>
      ) : (
        <div className="space-y-2">
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
              generationStatus={sw.generationStatus}
              generationError={sw.generationError}
              documentColor={sw.documentColor}
              documentColors={sw.documentColors}
            />
          ))}
        </div>
      )}
    </div>
  );
};
