import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useUpdateDocumentMutation } from '../../../store/api/Documents/documentsApi';

interface UseSourceRowTitleEditorParams {
  documentId: string;
  documentTitle: string;
}

export function useSourceRowTitleEditor({
  documentId,
  documentTitle,
}: UseSourceRowTitleEditorParams) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(documentTitle);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [updateDocument, { isLoading: isSavingTitle }] = useUpdateDocumentMutation();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const cancelEditRef = useRef(false);

  useEffect(() => {
    if (!isEditingTitle) {
      setDraftTitle(documentTitle);
    }
  }, [documentTitle, isEditingTitle]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const startEditingTitle = useCallback(() => {
    cancelEditRef.current = false;
    setDraftTitle(documentTitle);
    setTitleError(null);
    setIsEditingTitle(true);
  }, [documentTitle]);

  const cancelEditingTitle = useCallback(() => {
    cancelEditRef.current = true;
    setDraftTitle(documentTitle);
    setTitleError(null);
    setIsEditingTitle(false);
  }, [documentTitle]);

  const saveTitle = useCallback(async () => {
    const trimmed = draftTitle.trim();
    if (!trimmed) {
      setTitleError('Name is required');
      return;
    }

    if (trimmed === documentTitle) {
      setTitleError(null);
      setIsEditingTitle(false);
      return;
    }

    try {
      await updateDocument({
        documentId,
        title: trimmed,
      }).unwrap();
      setTitleError(null);
      setIsEditingTitle(false);
    } catch {
      // Error toast handled by global middleware
    }
  }, [documentId, documentTitle, draftTitle, updateDocument]);

  const handleTitleBlur = useCallback(() => {
    if (cancelEditRef.current) {
      cancelEditRef.current = false;
      return;
    }

    const trimmed = draftTitle.trim();
    if (!trimmed) {
      cancelEditingTitle();
      return;
    }

    void saveTitle();
  }, [cancelEditingTitle, draftTitle, saveTitle]);

  const handleTitleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void saveTitle();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        cancelEditingTitle();
        titleInputRef.current?.blur();
      }
    },
    [cancelEditingTitle, saveTitle],
  );

  const handleDraftTitleChange = useCallback(
    (value: string) => {
      setDraftTitle(value);
      if (titleError) {
        setTitleError(null);
      }
    },
    [titleError],
  );

  return {
    isEditingTitle,
    draftTitle,
    titleError,
    isSavingTitle,
    titleInputRef,
    startEditingTitle,
    cancelEditingTitle,
    saveTitle,
    handleTitleBlur,
    handleTitleKeyDown,
    handleDraftTitleChange,
  };
}
