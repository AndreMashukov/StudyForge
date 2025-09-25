import { useEffect } from 'react';
import { useGetUserQuizzesQuery } from '../../../../../store/api/Quiz/QuizApi';
import { Quiz } from '@shared-types';

export const useFetchMyQuizzesData = () => {
  // Fetch user quizzes - self-contained, no parameters needed
  const queryResult = useGetUserQuizzesQuery();

  // Auto-refresh on window focus (fetch-related effect)
  useEffect(() => {
    const handleWindowFocus = () => {
      queryResult.refetch();
    };

    window.addEventListener('focus', handleWindowFocus);
    
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [queryResult]);

  // Process data
  const quizzes: Quiz[] = queryResult.data?.data?.quizzes || [];
  const error = queryResult.error ? 'Failed to load quizzes' : null;

  return {
    ...queryResult,
    quizzes,
    error,
  };
};