import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  loadQuiz,
  startQuiz,
  selectAnswer,
  nextQuestion,
  completeQuiz,
  resetQuiz,
  skipQuestion,
} from '../../../../store/slices/quizPageSlice';
import { IQuizQuestion } from '../../types/IQuizTypes';
import { Quiz } from '@shared-types';

export const useQuizHandlers = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

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

  const handleCompleteQuiz = useCallback(() => {
    dispatch(completeQuiz());
  }, [dispatch]);

  const handleResetQuiz = useCallback(() => {
    dispatch(resetQuiz());
  }, [dispatch]);

  const handleSkipQuestion = useCallback(() => {
    dispatch(skipQuestion());
  }, [dispatch]);

  const handleNavigateToHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleNavigateToResults = useCallback(() => {
    // Navigate to results if there's a separate results page
    // For now, results are shown on the same page
  }, []);

  return {
    handleLoadQuiz,
    handleStartQuiz,
    handleAnswerSelect,
    handleNextQuestion,
    handleCompleteQuiz,
    handleResetQuiz,
    handleSkipQuestion,
    handleNavigateToHome,
    handleNavigateToResults,
  };
};