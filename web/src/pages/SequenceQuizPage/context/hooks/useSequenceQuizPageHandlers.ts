import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  placeItem,
  removeItem,
  reorderPlacedItem,
  resetBoard,
  checkAnswer,
  nextSequenceQuestion,
  completeSequenceQuiz,
  restartSequenceQuizSession,
  selectSequenceQuizState,
  selectCurrentSequenceQuestion,
  setSequenceFollowupGenerating,
  setSequenceFollowupGenerated,
  setSequenceFollowupError,
} from '../../../../store/slices/sequenceQuizPageSlice';
import { useGenerateQuizFollowupMutation } from '../../../../store/api/QuizFollowup/QuizFollowupApi';
import { IGenerateFollowupRequest } from '../../../../store/api/QuizFollowup/IQuizFollowupApi';

export const useSequenceQuizPageHandlers = () => {
  const dispatch = useDispatch();
  const quizState = useSelector(selectSequenceQuizState);
  const currentQuestion = useSelector(selectCurrentSequenceQuestion);

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

  const [generateFollowup] = useGenerateQuizFollowupMutation();

  const handleGenerateFollowup = useCallback(async () => {
    try {
      if (!currentQuestion || !quizState.isChecked) {
        return;
      }

      dispatch(setSequenceFollowupGenerating(true));

      const requestData: IGenerateFollowupRequest = {
        documentId: quizState.firestoreSequenceQuiz?.documentId || '',
        questionText: currentQuestion.question,
        userSelectedAnswer: quizState.placedItems.join(' -> '),
        correctAnswer: currentQuestion.explanation,
        questionOptions: currentQuestion.items,
        questionType: 'sequence',
        sequenceItems: currentQuestion.items,
        userSequence: quizState.placedItems,
        correctSequence: currentQuestion.items,
        quizTitle: quizState.firestoreSequenceQuiz?.title,
        followupRuleIds: quizState.firestoreSequenceQuiz?.followupRuleIds || [],
      };

      const result = await generateFollowup(requestData).unwrap();

      if (result.success && result.data?.content) {
        dispatch(setSequenceFollowupGenerated({
          questionIndex: quizState.currentQuestionIndex,
          content: result.data.content,
        }));
      } else {
        dispatch(setSequenceFollowupError('Failed to generate followup explanation'));
      }
    } catch (error) {
      const errorMessage = (error as { data?: string })?.data || 'Failed to generate followup explanation';
      dispatch(setSequenceFollowupError(errorMessage));
    }
  }, [currentQuestion, dispatch, generateFollowup, quizState]);

  return {
    handlePlaceItem,
    handleRemoveItem,
    handleReorderPlacedItem,
    handleResetBoard,
    handleCheckAnswer,
    handleNextQuestion,
    handleCompleteQuiz,
    handleResetQuiz,
    handleGenerateFollowup,
  };
};
