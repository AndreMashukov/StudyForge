import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useGetDiagramQuizQuery } from '../../../../../store/api/DiagramQuiz/DiagramQuizApi';
import { loadDiagramQuiz } from '../../../../../store/slices/diagramQuizPageSlice';
import { DiagramQuiz } from '@shared-types';
import { IDiagramQuizQuestion } from '../../../types/IDiagramQuizTypes';

export const useFetchDiagramQuizData = () => {
  const { diagramQuizId } = useParams<{ diagramQuizId: string }>();
  const dispatch = useDispatch();
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadedIdRef.current = null;
  }, [diagramQuizId]);

  const queryResult = useGetDiagramQuizQuery(
    { diagramQuizId: diagramQuizId || '' },
    { skip: !diagramQuizId }
  );

  const transform = useCallback((dq: DiagramQuiz): IDiagramQuizQuestion[] => {
    return dq.questions.map((q, index) => ({
      id: index + 1,
      question: q.question,
      diagrams: q.diagrams,
      diagramLabels: q.diagramLabels,
      correctAnswer: q.correctAnswer,
      correct: q.correctAnswer,
      explanation: q.explanation,
    }));
  }, []);

  const firestoreDiagramQuiz = queryResult.data?.data?.diagramQuiz ?? null;

  const transformedQuestions = useMemo(() => {
    return firestoreDiagramQuiz ? transform(firestoreDiagramQuiz) : [];
  }, [firestoreDiagramQuiz, transform]);

  useEffect(() => {
    if (
      firestoreDiagramQuiz &&
      transformedQuestions.length > 0 &&
      loadedIdRef.current !== firestoreDiagramQuiz.id
    ) {
      loadedIdRef.current = firestoreDiagramQuiz.id;
      dispatch(
        loadDiagramQuiz({
          diagramQuiz: firestoreDiagramQuiz,
          questions: transformedQuestions,
        })
      );
    }
  }, [firestoreDiagramQuiz, transformedQuestions, dispatch]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && diagramQuizId) {
        queryResult.refetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [diagramQuizId, queryResult.refetch]); // eslint-disable-line react-hooks/exhaustive-deps -- refetch is stable

  return {
    firestoreDiagramQuiz,
    questions: transformedQuestions,
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    error: queryResult.error,
    isError: queryResult.isError,
    isSuccess: queryResult.isSuccess,
    refetch: queryResult.refetch,
    hasValidId: Boolean(diagramQuizId),
    diagramQuizId,
  };
};
