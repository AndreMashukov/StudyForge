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
  setFollowupGenerating,
  setFollowupGenerated,
  setFollowupError,
  selectCurrentQuestion,
  selectQuizState,
  selectFormState,
} from '../../../../store/slices/quizPageSlice';
import { useQuizForm } from './useQuizForm';
import { IQuizQuestion } from '../../types/IQuizTypes';
import { Quiz } from '@shared-types';
import { useGenerateQuizFollowupMutation } from '../../../../store/api/QuizFollowup/QuizFollowupApi';
import { IGenerateFollowupRequest } from '../../../../store/api/QuizFollowup/IQuizFollowupApi';

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

  // Followup generation handler
  const [generateFollowup] = useGenerateQuizFollowupMutation();

  const handleGenerateFollowup = useCallback(async () => {
    try {
      if (!currentQuestion || formState.selectedAnswer === null) {
        return;
      }

      dispatch(setFollowupGenerating(true));

      const requestData: IGenerateFollowupRequest = {
        documentId: quizState.firestoreQuiz?.documentId || '',
        questionText: currentQuestion.question,
        userSelectedAnswer: currentQuestion.options[formState.selectedAnswer],
        correctAnswer: currentQuestion.options[currentQuestion.correct],
        questionOptions: currentQuestion.options,
        quizTitle: quizState.firestoreQuiz?.title,
        followupRuleIds: quizState.firestoreQuiz?.followupRuleIds || [], // Use stored rules
      };

      const result = await generateFollowup(requestData).unwrap();
      
      if (result.success) {
        dispatch(setFollowupGenerated({ 
          questionIndex: quizState.currentQuestionIndex 
        }));
      } else {
        dispatch(setFollowupError('Failed to generate followup explanation'));
      }

    } catch (error) {
      const errorMessage = (error as { data?: string })?.data || "Failed to generate followup explanation";
      dispatch(setFollowupError(errorMessage));
    }
  }, [dispatch, generateFollowup, currentQuestion, formState, quizState]);

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