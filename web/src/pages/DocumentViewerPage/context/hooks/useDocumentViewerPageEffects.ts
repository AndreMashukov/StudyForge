import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { buildDirectoryPathWithOptionalName } from '../../../../utils/directoryUrl';
import { useFetchDocumentData } from './api/useFetchDocumentData';

export const useDocumentViewerPageEffects = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const documentApi = useFetchDocumentData(documentId);
  const hadDocumentRef = useRef(false);
  const directoryIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!documentApi.data) {
      return;
    }
    hadDocumentRef.current = true;
    directoryIdRef.current = documentApi.data.directoryId || null;
  }, [documentApi.data]);

  useEffect(() => {
    if (!documentId || !hadDocumentRef.current) {
      return;
    }
    if (documentApi.isLoading || documentApi.isFetching) {
      return;
    }
    if (!documentApi.isError && documentApi.data) {
      return;
    }

    const directoryId = directoryIdRef.current;
    if (directoryId) {
      navigate(buildDirectoryPathWithOptionalName(directoryId), { replace: true });
      return;
    }
    navigate('/documents', { replace: true });
  }, [
    documentApi.data,
    documentApi.isError,
    documentApi.isFetching,
    documentApi.isLoading,
    documentId,
    navigate,
  ]);
};
