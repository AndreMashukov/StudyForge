import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  loadQuiz,
  startQuiz,
  selectAnswer,
  nextQuestion,
  completeQuiz,
  resetQuiz,
  skipQuestion,
} from '../../../../store/slices/quizPageSlice';
import { useQuizForm } from './useQuizForm';
import { IQuizQuestion } from '../../types/IQuizTypes';
import { Quiz } from '@shared-types';

export const useQuizPageHandlers = () => {
  const dispatch = useDispatch();
  
  // Form handlers
  const formHandlers = useQuizForm();

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
  }, [dispatch]);

  const handleCompleteQuiz = useCallback(() => {
    dispatch(completeQuiz());
  }, [dispatch]);

  const handleSkipQuestion = useCallback(() => {
    dispatch(skipQuestion());
  }, [dispatch]);

  return {
    // Quiz handlers (business logic only, no state)
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