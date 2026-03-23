import { Navigate, useSearchParams } from 'react-router-dom';

/**
 * `/quiz` and `/quiz/` without a quiz id do not match `/quiz/:quizId`.
 * Some links/bookmarks use `/quiz/?directoryId=...` — redirect to that directory.
 */
export const QuizIndexRedirect = () => {
  const [searchParams] = useSearchParams();
  const directoryId = searchParams.get('directoryId')?.trim();
  if (directoryId) {
    return <Navigate to={`/directory/${encodeURIComponent(directoryId)}`} replace />;
  }
  return <Navigate to="/" replace />;
};
