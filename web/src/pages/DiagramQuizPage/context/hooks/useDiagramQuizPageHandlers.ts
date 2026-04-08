import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  answerDiagramQuestion,
  nextDiagramQuestion,
  completeDiagramQuiz,
  restartDiagramQuizSession,
  setCurrentDiagramIndex,
  selectDiagramQuizState,
  selectCurrentDiagramQuestion,
  selectDiagramFormState,
  setDiagramFollowupGenerating,
  setDiagramFollowupGenerated,
  setDiagramFollowupError,
} from '../../../../store/slices/diagramQuizPageSlice';
import { useGenerateQuizFollowupMutation } from '../../../../store/api/QuizFollowup/QuizFollowupApi';
import { IGenerateFollowupRequest } from '../../../../store/api/QuizFollowup/IQuizFollowupApi';

export const useDiagramQuizPageHandlers = () => {
  const dispatch = useDispatch();
  const quizState = useSelector(selectDiagramQuizState);
  const currentQuestion = useSelector(selectCurrentDiagramQuestion);
  const formState = useSelector(selectDiagramFormState);

  const handleAnswerSelect = useCallback(
    (answerIndex: number) => {
      dispatch(answerDiagramQuestion({ answerIndex }));
    },
    [dispatch]
  );

  const handleNextQuestion = useCallback(() => {
    dispatch(nextDiagramQuestion());
  }, [dispatch]);

  const handleCompleteQuiz = useCallback(() => {
    dispatch(completeDiagramQuiz());
  }, [dispatch]);

  const handleResetQuiz = useCallback(() => {
    dispatch(restartDiagramQuizSession());
  }, [dispatch]);

  const handlePrevDiagram = useCallback(() => {
    const next = Math.max(0, quizState.currentDiagramIndex - 1);
    dispatch(setCurrentDiagramIndex({ index: next }));
  }, [dispatch, quizState.currentDiagramIndex]);

  const handleNextDiagram = useCallback(() => {
    const next = Math.min(3, quizState.currentDiagramIndex + 1);
    dispatch(setCurrentDiagramIndex({ index: next }));
  }, [dispatch, quizState.currentDiagramIndex]);

  const handleDiagramDotClick = useCallback(
    (index: number) => {
      dispatch(setCurrentDiagramIndex({ index }));
    },
    [dispatch]
  );

  // Followup generation handler
  const [generateFollowup] = useGenerateQuizFollowupMutation();

  const handleGenerateFollowup = useCallback(async () => {
    try {
      if (!currentQuestion || formState.selectedAnswer === null) {
        return;
      }

      dispatch(setDiagramFollowupGenerating(true));

      const diagramLabels = ['Diagram A', 'Diagram B', 'Diagram C', 'Diagram D'];

      const requestData: IGenerateFollowupRequest = {
        documentId: quizState.firestoreDiagramQuiz?.documentId || '',
        questionText: currentQuestion.question,
        userSelectedAnswer: diagramLabels[formState.selectedAnswer] || `Diagram ${formState.selectedAnswer + 1}`,
        correctAnswer: diagramLabels[currentQuestion.correct] || `Diagram ${currentQuestion.correct + 1}`,
        questionOptions: diagramLabels,
        quizTitle: quizState.firestoreDiagramQuiz?.title,
        followupRuleIds: quizState.firestoreDiagramQuiz?.followupRuleIds || [],
      };

      const result = await generateFollowup(requestData).unwrap();

      if (result.success && result.data?.content) {
        dispatch(setDiagramFollowupGenerated({
          questionIndex: quizState.currentQuestionIndex,
          content: result.data.content,
        }));
      } else {
        dispatch(setDiagramFollowupError('Failed to generate followup explanation'));
      }
    } catch (error) {
      const errorMessage = (error as { data?: string })?.data || 'Failed to generate followup explanation';
      dispatch(setDiagramFollowupError(errorMessage));
    }
  }, [dispatch, generateFollowup, currentQuestion, formState, quizState]);

  return {
    handleAnswerSelect,
    handleNextQuestion,
    handleCompleteQuiz,
    handleResetQuiz,
    handlePrevDiagram,
    handleNextDiagram,
    handleDiagramDotClick,
    handleGenerateFollowup,
  };
};
