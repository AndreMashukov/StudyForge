import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  placeOption,
  removeOption,
  resetBoard,
  checkAnswer,
  nextMatchQuestion,
  completeMatchQuiz,
  restartMatchQuizSession,
  selectMatchQuizState,
  selectCurrentMatchQuestion,
  openMatchFollowupChat,
} from '../../../../store/slices/matchQuizPageSlice';

export const useMatchQuizPageHandlers = () => {
  const dispatch = useDispatch();
  const quizState = useSelector(selectMatchQuizState);
  const currentQuestion = useSelector(selectCurrentMatchQuestion);

  const handlePlaceOption = useCallback(
    (promptId: string, optionId: string) => {
      dispatch(placeOption({ promptId, optionId }));
    },
    [dispatch]
  );

  const handleRemoveOption = useCallback(
    (promptId: string) => {
      dispatch(removeOption({ promptId }));
    },
    [dispatch]
  );

  const handleResetBoard = useCallback(() => {
    dispatch(resetBoard());
  }, [dispatch]);

  const handleCheckAnswer = useCallback(() => {
    dispatch(checkAnswer());
  }, [dispatch]);

  const handleNextQuestion = useCallback(() => {
    dispatch(nextMatchQuestion());
  }, [dispatch]);

  const handleCompleteQuiz = useCallback(() => {
    dispatch(completeMatchQuiz());
  }, [dispatch]);

  const handleResetQuiz = useCallback(() => {
    dispatch(restartMatchQuizSession());
  }, [dispatch]);

  const handleGenerateFollowup = useCallback(() => {
    if (!currentQuestion || !quizState.isChecked) {
      return;
    }

    dispatch(openMatchFollowupChat({ questionIndex: quizState.currentQuestionIndex }));
  }, [currentQuestion, dispatch, quizState.currentQuestionIndex, quizState.isChecked]);

  return {
    handlePlaceOption,
    handleRemoveOption,
    handleResetBoard,
    handleCheckAnswer,
    handleNextQuestion,
    handleCompleteQuiz,
    handleResetQuiz,
    handleGenerateFollowup,
  };
};