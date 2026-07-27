import React, { useCallback } from 'react';
import { Box } from 'lucide-react';
import { ArtifactSummary } from '@shared-types';
import { useAppDispatch } from '../../hooks/redux';
import { subjectWorldApi } from '../../store/api/SubjectWorld/SubjectWorldApi';
import { VirtualizedArtifactPanel } from './VirtualizedArtifactPanel';

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

  return (
    <VirtualizedArtifactPanel
      artifacts={subjectWorlds}
      directoryId={directoryId}
      panelType="subjectWorlds"
      title="Subject worlds"
      createLabel="+ Create subject world"
      createPath={`/subject-world/create?directoryId=${encodeURIComponent(directoryId)}`}
      emptyMessage="No subject worlds in this directory yet."
      entityLabel="subject worlds"
      artifactType="subjectWorld"
      icon={Box}
      buildLinkTo={(artifactId) =>
        `/subject-world/${artifactId}?directoryId=${encodeURIComponent(directoryId)}`
      }
      onDeleteArtifact={onDeleteArtifact}
      onPrefetch={prefetchSubjectWorld}
      ruleNamesMap={ruleNamesMap}
      mayBeTruncated={mayBeTruncated}
    />
  );
};
