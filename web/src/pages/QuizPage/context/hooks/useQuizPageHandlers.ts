import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  loadQuiz,
  startQuiz,
  selectAnswer,
  nextQuestion,
  completeQuiz,
  resetQuiz,
  skipQuestion,
  selectCurrentQuestion,
  selectProgress,
  selectQuizStats,
  selectIsLoading,
  selectError,
} from '../../../../store/slices/quizPageSlice';
import { useFetchQuizData } from './api/useFetchQuizData';
import { useQuizForm } from './useQuizForm';
import { IQuizQuestion } from '../../types/IQuizTypes';
import { Quiz } from '@shared-types';

export const useQuizPageHandlers = () => {
  const dispatch = useDispatch();
  const loadedQuizIdRef = useRef<string | null>(null);

  // API data fetching
  const quizData = useFetchQuizData();
  
  // Form handlers
  const formHandlers = useQuizForm();

  // Redux state selectors
  const currentQuestion = useSelector(selectCurrentQuestion);
  const progress = useSelector(selectProgress);
  const stats = useSelector(selectQuizStats);
  const isLoading = useSelector(selectIsLoading) || quizData.isLoading;
  const error = useSelector(selectError) || (quizData.error ? String(quizData.error) : null);

  // Load quiz data when it becomes available (fetch-related effect)
  useEffect(() => {
    if (quizData.firestoreQuiz && 
        quizData.questions.length > 0 && 
        loadedQuizIdRef.current !== quizData.firestoreQuiz.id) {
      
      loadedQuizIdRef.current = quizData.firestoreQuiz.id;
      dispatch(loadQuiz({ 
        quiz: quizData.firestoreQuiz, 
        questions: quizData.questions 
      }));
    }
  }, [quizData.firestoreQuiz, quizData.questions, dispatch]);

  // Quiz action handlers
  const handleLoadQuiz = useCallback((firestoreQuiz: Quiz, questions: IQuizQuestion[]) => {
    dispatch(loadQuiz({ quiz: firestoreQuiz, questions }));
  }, [dispatch]);

  const handleStartQuiz = useCallback((questions: IQuizQuestion[]) => {
    dispatch(startQuiz({ questions }));
  }, [dispatch]);

  const handleAnswerSelect = useCallback((answerIndex: number) => {
    dispatch(selectAnswer({ answerIndex }));
  }, [dispatch]);

  const handleNextQuestion = useCallback(() => {
    dispatch(nextQuestion());
  }, [dispatch]);

  const handleResetQuiz = useCallback(() => {
    dispatch(resetQuiz());
    loadedQuizIdRef.current = null;
  }, [dispatch]);

  const handleCompleteQuiz = useCallback(() => {
    dispatch(completeQuiz());
  }, [dispatch]);

  const handleSkipQuestion = useCallback(() => {
    dispatch(skipQuestion());
  }, [dispatch]);

  return {
    // Quiz data (computed from Redux state)
    currentQuestion,
    progress,
    stats,
    isLoading,
    error,

    // Quiz handlers
    handleLoadQuiz,
    handleAnswerSelect,
    handleNextQuestion,
    handleResetQuiz,
    handleStartQuiz,
    handleCompleteQuiz,
    handleSkipQuestion,

    // Form handlers
    handleSubmitAnswer: formHandlers.handleSubmitAnswer,
    handleValidateAnswer: formHandlers.handleValidateAnswer,
    clearFormErrors: formHandlers.clearFormErrors,
  };
};