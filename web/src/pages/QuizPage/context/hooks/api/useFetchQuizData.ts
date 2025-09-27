import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useGetQuizQuery } from '../../../../../store/api/Quiz/QuizApi';
import { loadQuiz } from '../../../../../store/slices/quizPageSlice';
import { Quiz } from '@shared-types';
import { IQuizQuestion } from '../../../types/IQuizTypes';

export const useFetchQuizData = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const dispatch = useDispatch();
  const loadedQuizIdRef = useRef<string | null>(null);
  
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
      explanation: question.explanation, // Use actual explanation from API
    }));
  }, []);

  // Computed values with useMemo to prevent unnecessary re-renders
  const firestoreQuiz = queryResult.data?.data?.quiz || null;
  
  const transformedQuestions = useMemo(() => {
    return firestoreQuiz ? transformQuizData(firestoreQuiz) : [];
  }, [firestoreQuiz, transformQuizData]);
  const refetchFn = queryResult.refetch;

  // Load quiz data into Redux when it becomes available (fetch-related effect)
  useEffect(() => {
    if (firestoreQuiz && 
        transformedQuestions.length > 0 && 
        loadedQuizIdRef.current !== firestoreQuiz.id) {
      
      loadedQuizIdRef.current = firestoreQuiz.id;
      dispatch(loadQuiz({ 
        quiz: firestoreQuiz, 
        questions: transformedQuestions 
      }));
    }
  }, [firestoreQuiz, transformedQuestions, dispatch]);

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