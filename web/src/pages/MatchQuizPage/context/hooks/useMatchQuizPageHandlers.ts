import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  placeOption,
  removeOption,
  resetBoard,
  retryAfterCheck,
  checkAnswer,
  nextMatchQuestion,
  completeMatchQuiz,
  restartMatchQuizSession,
} from '../../../../store/slices/matchQuizPageSlice';

export const useMatchQuizPageHandlers = () => {
  const dispatch = useDispatch();

  const handlePlaceOption = useCallback(
    (promptId: string, optionId: string) => {
      dispatch(placeOption({ promptId, optionId }));
    },
    [dispatch],
  );

  const handleRemoveOption = useCallback(
    (promptId: string) => {
      dispatch(removeOption({ promptId }));
    },
    [dispatch],
  );

  const handleResetBoard = useCallback(() => {
    dispatch(resetBoard());
  }, [dispatch]);

  const handleRetryAfterCheck = useCallback(() => {
    dispatch(retryAfterCheck());
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

  return {
    handlePlaceOption,
    handleRemoveOption,
    handleResetBoard,
    handleRetryAfterCheck,
    handleCheckAnswer,
    handleNextQuestion,
    handleCompleteQuiz,
    handleResetQuiz,
  };
};
