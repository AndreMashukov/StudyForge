import { useGetUserQuizzesQuery, useGetRecentQuizzesQuery } from '../../../../../store/api/Quiz/QuizApi';

export const useFetchQuizzes = () => {
  const {
    data: userQuizzesData,
    isLoading: isUserQuizzesLoading,
    error: userQuizzesError,
    refetch: refetchUserQuizzes
  } = useGetUserQuizzesQuery();

  const {
    data: recentQuizzesData,
    isLoading: isRecentQuizzesLoading,
    error: recentQuizzesError,
    refetch: refetchRecentQuizzes
  } = useGetRecentQuizzesQuery();

  return {
    userQuizzes: {
      data: userQuizzesData?.success ? userQuizzesData.data?.quizzes : undefined,
      isLoading: isUserQuizzesLoading,
      error: userQuizzesError,
      refetch: refetchUserQuizzes,
    },
    recentQuizzes: {
      data: recentQuizzesData?.success ? recentQuizzesData.data?.quizzes : undefined,
      isLoading: isRecentQuizzesLoading,
      error: recentQuizzesError,
      refetch: refetchRecentQuizzes,
    },
  };
};