import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  placeItem,
  removeItem,
  reorderPlacedItem,
  resetBoard,
  checkAnswer,
  nextSequenceQuestion,
  completeSequenceQuiz,
  restartSequenceQuizSession,
} from '../../../../store/slices/sequenceQuizPageSlice';

export const useSequenceQuizPageHandlers = () => {
  const dispatch = useDispatch();

  const handlePlaceItem = useCallback(
    (item: string, atIndex?: number) => {
      dispatch(placeItem({ item, atIndex }));
    },
    [dispatch]
  );

  const handleRemoveItem = useCallback(
    (item: string) => {
      dispatch(removeItem({ item }));
    },
    [dispatch]
  );

  const handleReorderPlacedItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      dispatch(reorderPlacedItem({ fromIndex, toIndex }));
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
    dispatch(nextSequenceQuestion());
  }, [dispatch]);

  const handleCompleteQuiz = useCallback(() => {
    dispatch(completeSequenceQuiz());
  }, [dispatch]);

  const handleResetQuiz = useCallback(() => {
    dispatch(restartSequenceQuizSession());
  }, [dispatch]);

  return {
    handlePlaceItem,
    handleRemoveItem,
    handleReorderPlacedItem,
    handleResetBoard,
    handleCheckAnswer,
    handleNextQuestion,
    handleCompleteQuiz,
    handleResetQuiz,
  };
};
