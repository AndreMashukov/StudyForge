import React, { useCallback } from 'react';
import { Puzzle } from 'lucide-react';
import { ArtifactSummary } from '@shared-types';
import { useAppDispatch } from '../../hooks/redux';
import { matchQuizApi } from '../../store/api/MatchQuiz/MatchQuizApi';
import { VirtualizedArtifactPanel } from './VirtualizedArtifactPanel';

interface MatchQuizzesPanelProps {
  matchQuizzes: ArtifactSummary[];
  directoryId: string;
  mayBeTruncated?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'matchQuiz' }) => void;
  ruleNamesMap?: Map<string, string>;
  onCreate: () => void;
}

export const MatchQuizzesPanel: React.FC<MatchQuizzesPanelProps> = ({
  matchQuizzes,
  directoryId,
  mayBeTruncated = false,
  onDeleteArtifact,
  ruleNamesMap,
  onCreate,
}) => {
  const dispatch = useAppDispatch();
  const prefetchMatchQuiz = useCallback(
    (matchQuizId: string) => {
      dispatch(
        matchQuizApi.util.prefetch('getMatchQuiz', { matchQuizId }, { force: false }),
      );
    },
    [dispatch],
  );

  return (
    <VirtualizedArtifactPanel
      artifacts={matchQuizzes}
      directoryId={directoryId}
      panelType="matchQuizzes"
      title="Match quizzes"
      createLabel="+ Create match quiz"
      onCreate={onCreate}
      emptyMessage="No match quizzes in this directory yet."
      entityLabel="match quizzes"
      artifactType="matchQuiz"
      icon={Puzzle}
      buildLinkTo={(artifactId) =>
        `/match-quiz/${artifactId}?directoryId=${encodeURIComponent(directoryId)}`
      }
      onDeleteArtifact={onDeleteArtifact}
      onPrefetch={prefetchMatchQuiz}
      ruleNamesMap={ruleNamesMap}
      mayBeTruncated={mayBeTruncated}
    />
  );
};