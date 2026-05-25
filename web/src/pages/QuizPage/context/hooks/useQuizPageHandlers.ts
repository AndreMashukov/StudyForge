import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  loadQuiz,
  startQuiz,
  selectAnswer,
  nextQuestion,
  completeQuiz,
  resetQuiz,
  skipQuestion,
  openFollowupChat,
  selectCurrentQuestion,
  selectQuizState,
  selectFormState,
} from '../../../../store/slices/quizPageSlice';
import { useQuizForm } from './useQuizForm';
import { IQuizQuestion } from '../../types/IQuizTypes';
import { Quiz } from '@shared-types';

export const useQuizPageHandlers = () => {
  const dispatch = useDispatch();
  const currentQuestion = useSelector(selectCurrentQuestion);
  const quizState = useSelector(selectQuizState);
  const formState = useSelector(selectFormState);
  
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

  const handleGenerateFollowup = useCallback(async () => {
    if (!currentQuestion || formState.selectedAnswer === null) {
      return;
    }

    dispatch(openFollowupChat({ questionIndex: quizState.currentQuestionIndex }));
  }, [currentQuestion, dispatch, formState.selectedAnswer, quizState.currentQuestionIndex]);

  return {
    // Quiz handlers (business logic only, no state)
    handleLoadQuiz,
    handleAnswerSelect,
    handleNextQuestion,
    handleResetQuiz,
    handleStartQuiz,
    handleCompleteQuiz,
    handleSkipQuestion,
    handleGenerateFollowup,

    // Form handlers
    handleSubmitAnswer: formHandlers.handleSubmitAnswer,
    handleValidateAnswer: formHandlers.handleValidateAnswer,
    clearFormErrors: formHandlers.clearFormErrors,
  };
};