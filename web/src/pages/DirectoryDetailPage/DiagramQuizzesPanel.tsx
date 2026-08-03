import React, { useCallback } from 'react';
import { Network } from 'lucide-react';
import { ArtifactSummary } from '@shared-types';
import { useAppDispatch } from '../../hooks/redux';
import { diagramQuizApi } from '../../store/api/DiagramQuiz/DiagramQuizApi';
import { VirtualizedArtifactPanel } from './VirtualizedArtifactPanel';

interface DiagramQuizzesPanelProps {
  diagramQuizzes: ArtifactSummary[];
  directoryId: string;
  mayBeTruncated?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'diagramQuiz' }) => void;
  ruleNamesMap?: Map<string, string>;
  onCreate: () => void;
}

export const DiagramQuizzesPanel: React.FC<DiagramQuizzesPanelProps> = ({
  diagramQuizzes,
  directoryId,
  mayBeTruncated = false,
  onDeleteArtifact,
  ruleNamesMap,
  onCreate,
}) => {
  const dispatch = useAppDispatch();
  const prefetchDiagramQuiz = useCallback(
    (diagramQuizId: string) => {
      dispatch(
        diagramQuizApi.util.prefetch('getDiagramQuiz', { diagramQuizId }, { force: false }),
      );
    },
    [dispatch],
  );

  return (
    <VirtualizedArtifactPanel
      artifacts={diagramQuizzes}
      directoryId={directoryId}
      panelType="diagramQuizzes"
      title="Diagram quizzes"
      createLabel="+ Create diagram quiz"
      onCreate={onCreate}
      emptyMessage="No diagram quizzes in this directory yet."
      entityLabel="diagram quizzes"
      artifactType="diagramQuiz"
      icon={Network}
      buildLinkTo={(artifactId) =>
        `/diagram-quiz/${artifactId}?directoryId=${encodeURIComponent(directoryId)}`
      }
      onDeleteArtifact={onDeleteArtifact}
      onPrefetch={prefetchDiagramQuiz}
      ruleNamesMap={ruleNamesMap}
      mayBeTruncated={mayBeTruncated}
    />
  );
};
