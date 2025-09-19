import { useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useGetQuizQuery } from '../../../../../store/api/Quiz/QuizApi';
import { Quiz } from '@shared-types';
import { IQuizQuestion } from '../../../types/IQuizTypes';

export const useFetchQuizData = () => {
  const { quizId } = useParams<{ quizId: string }>();
  
  // RTK Query hook to fetch quiz data
  const queryResult = useGetQuizQuery(
    { quizId: quizId || '' },
    { skip: !quizId } // Skip query if no quizId
  );

  // Transform Firestore Quiz data to UI Quiz format
  const transformQuizData = useCallback((firestoreQuiz: Quiz): IQuizQuestion[] => {
    return firestoreQuiz.questions.map((question, index) => ({
      id: index + 1, // Add numeric ID for UI
      question: question.question,
      options: question.options,
      correct: question.correctAnswer,
      correctAnswer: question.correctAnswer, // Keep both for compatibility
      explanation: `This is the correct answer for question ${index + 1}.`, // Could be added to Firestore schema later
    }));
  }, []);

  // Computed values
  const transformedQuestions = queryResult.data?.data?.quiz 
    ? transformQuizData(queryResult.data.data.quiz)
    : [];

  const firestoreQuiz = queryResult.data?.data?.quiz || null;
  const refetchFn = queryResult.refetch;

  // Auto-refetch when page becomes visible (fetch-related effect)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && quizId) {
        refetchFn();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [quizId, refetchFn]);

  return {
    // Original quiz data from Firestore
    firestoreQuiz,
    
    // Transformed data for UI
    questions: transformedQuestions,
    
    // Query state
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    error: queryResult.error,
    isError: queryResult.isError,
    isSuccess: queryResult.isSuccess,
    
    // Actions
    refetch: queryResult.refetch,
    
    // Validation
    hasValidQuizId: Boolean(quizId),
    quizId,
  };
};