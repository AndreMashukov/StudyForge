import React, { useCallback } from 'react';
import { ListOrdered } from 'lucide-react';
import { ArtifactSummary } from '@shared-types';
import { useAppDispatch } from '../../hooks/redux';
import { sequenceQuizApi } from '../../store/api/SequenceQuiz/SequenceQuizApi';
import { VirtualizedArtifactPanel } from './VirtualizedArtifactPanel';

interface SequenceQuizzesPanelProps {
  sequenceQuizzes: ArtifactSummary[];
  directoryId: string;
  mayBeTruncated?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'sequenceQuiz' }) => void;
  ruleNamesMap?: Map<string, string>;
  onCreate: () => void;
}

export const SequenceQuizzesPanel: React.FC<SequenceQuizzesPanelProps> = ({
  sequenceQuizzes,
  directoryId,
  mayBeTruncated = false,
  onDeleteArtifact,
  ruleNamesMap,
  onCreate,
}) => {
  const dispatch = useAppDispatch();
  const prefetchSequenceQuiz = useCallback(
    (sequenceQuizId: string) => {
      dispatch(
        sequenceQuizApi.util.prefetch('getSequenceQuiz', { sequenceQuizId }, { force: false }),
      );
    },
    [dispatch],
  );

  return (
    <VirtualizedArtifactPanel
      artifacts={sequenceQuizzes}
      directoryId={directoryId}
      panelType="sequenceQuizzes"
      title="Sequence quizzes"
      createLabel="+ Create sequence quiz"
      onCreate={onCreate}
      emptyMessage="No sequence quizzes in this directory yet."
      entityLabel="sequence quizzes"
      artifactType="sequenceQuiz"
      icon={ListOrdered}
      buildLinkTo={(artifactId) =>
        `/sequence-quiz/${artifactId}?directoryId=${encodeURIComponent(directoryId)}`
      }
      onDeleteArtifact={onDeleteArtifact}
      onPrefetch={prefetchSequenceQuiz}
      ruleNamesMap={ruleNamesMap}
      mayBeTruncated={mayBeTruncated}
    />
  );
};
