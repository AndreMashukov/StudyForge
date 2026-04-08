import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useGetSequenceQuizQuery } from '../../../../../store/api/SequenceQuiz/SequenceQuizApi';
import { loadSequenceQuiz, ISequenceQuizQuestion } from '../../../../../store/slices/sequenceQuizPageSlice';
import { SequenceQuiz } from '@shared-types';

export const useFetchSequenceQuizData = () => {
  const { sequenceQuizId } = useParams<{ sequenceQuizId: string }>();
  const dispatch = useDispatch();
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadedIdRef.current = null;
  }, [sequenceQuizId]);

  const queryResult = useGetSequenceQuizQuery(
    { sequenceQuizId: sequenceQuizId || '' },
    { skip: !sequenceQuizId }
  );

  const transform = useCallback((sq: SequenceQuiz): ISequenceQuizQuestion[] => {
    return sq.questions.map((q, index) => ({
      id: index + 1,
      question: q.question,
      items: q.items,
      explanation: q.explanation,
      hint: q.hint,
    }));
  }, []);

  const firestoreSequenceQuiz = queryResult.data?.data?.sequenceQuiz ?? null;

  const transformedQuestions = useMemo(() => {
    return firestoreSequenceQuiz ? transform(firestoreSequenceQuiz) : [];
  }, [firestoreSequenceQuiz, transform]);

  useEffect(() => {
    if (
      firestoreSequenceQuiz &&
      transformedQuestions.length > 0 &&
      loadedIdRef.current !== firestoreSequenceQuiz.id
    ) {
      loadedIdRef.current = firestoreSequenceQuiz.id;
      dispatch(
        loadSequenceQuiz({
          sequenceQuiz: firestoreSequenceQuiz,
          questions: transformedQuestions,
        })
      );
    }
  }, [firestoreSequenceQuiz, transformedQuestions, dispatch]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && sequenceQuizId) {
        queryResult.refetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [sequenceQuizId, queryResult.refetch]); // eslint-disable-line react-hooks/exhaustive-deps -- refetch is stable

  return {
    firestoreSequenceQuiz,
    questions: transformedQuestions,
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    error: queryResult.error,
    isError: queryResult.isError,
    isSuccess: queryResult.isSuccess,
    refetch: queryResult.refetch,
    hasValidId: Boolean(sequenceQuizId),
    sequenceQuizId,
  };
};
