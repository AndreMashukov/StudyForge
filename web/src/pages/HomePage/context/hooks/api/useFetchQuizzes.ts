import { useGetUserQuizzesQuery } from '../../../../../store/api/Quiz/QuizApi';

export const useFetchQuizzes = () => {
  const {
    data: userQuizzesData,
    isLoading: isUserQuizzesLoading,
    error: userQuizzesError,
    refetch: refetchUserQuizzes
  } = useGetUserQuizzesQuery();

  return {
    userQuizzes: {
      data: userQuizzesData?.success ? userQuizzesData.data?.quizzes : undefined,
      isLoading: isUserQuizzesLoading,
      error: userQuizzesError,
      refetch: refetchUserQuizzes,
    },
  };
};
