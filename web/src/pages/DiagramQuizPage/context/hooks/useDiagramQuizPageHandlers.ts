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
  openDiagramFollowupChat,
} from '../../../../store/slices/diagramQuizPageSlice';

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

  const handleGenerateFollowup = useCallback(async () => {
    if (!currentQuestion || formState.selectedAnswer === null) {
      return;
    }

    dispatch(openDiagramFollowupChat({ questionIndex: quizState.currentQuestionIndex }));
  }, [currentQuestion, dispatch, formState.selectedAnswer, quizState.currentQuestionIndex]);

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
