import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useGetMatchQuizQuery } from '../../../../../store/api/MatchQuiz/MatchQuizApi';
import { loadMatchQuiz, IMatchQuizViewQuestion } from '../../../../../store/slices/matchQuizPageSlice';
import { MatchQuiz } from '@shared-types';

export const useFetchMatchQuizData = () => {
  const { matchQuizId } = useParams<{ matchQuizId: string }>();
  const dispatch = useDispatch();
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadedIdRef.current = null;
  }, [matchQuizId]);

  const queryResult = useGetMatchQuizQuery(
    { matchQuizId: matchQuizId || '' },
    {
      skip: !matchQuizId,
      refetchOnFocus: false,
      refetchOnReconnect: false,
    },
  );

  const transform = useCallback((mq: MatchQuiz): IMatchQuizViewQuestion[] => {
    return mq.questions.map((q, index) => ({
      id: index + 1,
      question:
        typeof q.question === 'string' && q.question.trim().length > 0
          ? q.question.trim()
          : 'Match each item to the correct option.',
      prompts: q.prompts,
      options: q.options,
      explanation: q.explanation,
      hint: q.hint,
    }));
  }, []);

  const firestoreMatchQuiz = queryResult.data?.data?.matchQuiz ?? null;

  const transformedQuestions = useMemo(() => {
    return firestoreMatchQuiz ? transform(firestoreMatchQuiz) : [];
  }, [firestoreMatchQuiz, transform]);

  useEffect(() => {
    if (
      firestoreMatchQuiz &&
      transformedQuestions.length > 0 &&
      loadedIdRef.current !== firestoreMatchQuiz.id
    ) {
      loadedIdRef.current = firestoreMatchQuiz.id;
      dispatch(
        loadMatchQuiz({
          matchQuiz: firestoreMatchQuiz,
          questions: transformedQuestions,
        })
      );
    }
  }, [firestoreMatchQuiz, transformedQuestions, dispatch]);

  return {
    firestoreMatchQuiz,
    questions: transformedQuestions,
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    error: queryResult.error,
    isError: queryResult.isError,
    isSuccess: queryResult.isSuccess,
    refetch: queryResult.refetch,
    hasValidId: Boolean(matchQuizId),
    matchQuizId,
  };
};