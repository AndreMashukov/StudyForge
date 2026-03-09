import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeleteFlashcardSetMutation } from '../../../../store/api/Flashcards/FlashcardsApi';
import { IFlashcardsPageHandlers } from '../../types/IFlashcardsPageContext';

export const useFlashcardsPageHandlers = (): IFlashcardsPageHandlers => {
  const navigate = useNavigate();
  const [deleteFlashcardSet] = useDeleteFlashcardSetMutation();

  const handleViewFlashcardSet = useCallback(
    (id: string) => {
      navigate(`/flashcards/${id}`);
    },
    [navigate]
  );

  const handleDeleteFlashcardSet = useCallback(
    async (flashcardSetId: string) => {
      const confirmed = window.confirm(
        'Are you sure you want to delete this flashcard set?'
      );
      if (confirmed) {
        await deleteFlashcardSet({ flashcardSetId });
      }
    },
    [deleteFlashcardSet]
  );

  return { handleViewFlashcardSet, handleDeleteFlashcardSet };
};
