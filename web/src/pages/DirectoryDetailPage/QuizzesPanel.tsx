import React, { useCallback } from 'react';
import { Brain } from 'lucide-react';
import { ArtifactSummary } from '@shared-types';
import { useAppDispatch } from '../../hooks/redux';
import { quizApi } from '../../store/api/Quiz/QuizApi';
import { VirtualizedArtifactPanel } from './VirtualizedArtifactPanel';

interface QuizzesPanelProps {
  quizzes: ArtifactSummary[];
  directoryId: string;
  mayBeTruncated?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'quiz' }) => void;
  ruleNamesMap?: Map<string, string>;
  onCreate: () => void;
}

export const QuizzesPanel: React.FC<QuizzesPanelProps> = ({
  quizzes,
  directoryId,
  mayBeTruncated = false,
  onDeleteArtifact,
  ruleNamesMap,
  onCreate,
}) => {
  const dispatch = useAppDispatch();
  const prefetchQuiz = useCallback(
    (quizId: string) => {
      dispatch(quizApi.util.prefetch('getQuiz', { quizId }, { force: false }));
    },
    [dispatch],
  );

  return (
    <VirtualizedArtifactPanel
      artifacts={quizzes}
      directoryId={directoryId}
      panelType="quizzes"
      title="Quizzes"
      createLabel="+ Create quiz"
      onCreate={onCreate}
      emptyMessage="No quizzes in this directory yet."
      entityLabel="quizzes"
      artifactType="quiz"
      icon={Brain}
      buildLinkTo={(artifactId) =>
        `/quiz/${artifactId}?directoryId=${encodeURIComponent(directoryId)}`
      }
      onDeleteArtifact={onDeleteArtifact}
      onPrefetch={prefetchQuiz}
      ruleNamesMap={ruleNamesMap}
      mayBeTruncated={mayBeTruncated}
    />
  );
};
