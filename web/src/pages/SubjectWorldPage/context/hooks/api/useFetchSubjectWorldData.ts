import { useParams } from 'react-router-dom';
import {
  useGetSubjectWorldQuery,
  useGetSubjectWorldProgressQuery,
} from '../../../../../store/api/SubjectWorld/SubjectWorldApi';

export const useFetchSubjectWorldData = () => {
  const { subjectWorldId } = useParams<{ subjectWorldId: string }>();
  const hasValidId = Boolean(subjectWorldId?.trim());

  const queryResult = useGetSubjectWorldQuery(
    { subjectWorldId: subjectWorldId ?? '' },
    { skip: !hasValidId }
  );

  const progressQuery = useGetSubjectWorldProgressQuery(
    { subjectWorldId: subjectWorldId ?? '' },
    { skip: !hasValidId }
  );

  const subjectWorld = queryResult.data?.success ? queryResult.data.data?.subjectWorld : null;

  return {
    subjectWorld,
    progress: progressQuery.data?.success ? progressQuery.data.data?.progress ?? null : null,
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    error: queryResult.error,
    isError: queryResult.isError,
    isSuccess: queryResult.isSuccess,
    refetch: queryResult.refetch,
    hasValidId,
    subjectWorldId,
  };
};
