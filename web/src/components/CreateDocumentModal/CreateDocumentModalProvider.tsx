import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { CreateDocumentPageContext } from '../../pages/CreateDocumentPage/context/CreateDocumentPageContext';
import { ICreateDocumentPageContext } from '../../pages/CreateDocumentPage/types/ICreateDocumentPageContext';
import { useCreateDocumentPageHandlers } from '../../pages/CreateDocumentPage/context/hooks/useCreateDocumentPageHandlers';
import { setSelectedDirectory } from '../../store/slices/directorySlice';
import {
  resetCreateDocumentPage,
  setDirectoryId,
  setPromptRules,
  setScrapingRules,
  setSelectedSource,
  setUploadRules,
} from '../../store/slices/createDocumentPageSlice';

interface CreateDocumentModalProviderProps {
  open: boolean;
  directoryId: string;
  onRequestStarted?: (directoryId: string) => void;
  children: React.ReactNode;
}

export const CreateDocumentModalProvider: React.FC<CreateDocumentModalProviderProps> = ({
  open,
  directoryId,
  onRequestStarted,
  children,
}) => {
  const dispatch = useDispatch();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsReady(false);
      return;
    }

    dispatch(resetCreateDocumentPage());
    dispatch(setSelectedDirectory(directoryId));
    dispatch(setDirectoryId(directoryId));
    dispatch(setSelectedSource('textPrompt'));
    dispatch(setPromptRules([]));
    dispatch(setScrapingRules([]));
    dispatch(setUploadRules([]));
    setIsReady(true);

    return () => {
      setIsReady(false);
      dispatch(resetCreateDocumentPage());
    };
  }, [open, directoryId, dispatch]);

  const handlers = useCreateDocumentPageHandlers({
    onRequestStarted,
  });

  const contextValue: ICreateDocumentPageContext = useMemo(
    () => ({
      handlers,
      isReady,
    }),
    [handlers, isReady],
  );

  return (
    <CreateDocumentPageContext.Provider value={contextValue}>
      {children}
    </CreateDocumentPageContext.Provider>
  );
};
