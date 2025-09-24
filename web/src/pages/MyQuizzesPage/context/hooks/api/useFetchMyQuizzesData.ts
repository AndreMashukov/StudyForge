import { useGetUserQuizzesQuery } from '../../../../../store/api/Quiz/QuizApi';
import { Quiz } from '@shared-types';

export const useFetchMyQuizzesData = () => {
  // Fetch user quizzes - self-contained, no parameters needed
  const queryResult = useGetUserQuizzesQuery();

  // Process data
  const quizzes: Quiz[] = queryResult.data?.data?.quizzes || [];
  const error = queryResult.error ? 'Failed to load quizzes' : null;

  return {
    ...queryResult,
    quizzes,
    error,
  };
};