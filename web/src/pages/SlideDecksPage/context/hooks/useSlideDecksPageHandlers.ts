import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeleteSlideDeckMutation } from '../../../../store/api/SlideDecks/SlideDecksApi';
import { ISlideDecksPageHandlers } from '../../types/ISlideDecksPageHandlers';

export const useSlideDecksPageHandlers = (): ISlideDecksPageHandlers => {
  const navigate = useNavigate();
  const [deleteSlideDeck] = useDeleteSlideDeckMutation();

  const handleView = useCallback(
    (slideDeckId: string) => navigate(`/slides/${slideDeckId}`),
    [navigate]
  );

  const handleDelete = useCallback(
    async (slideDeckId: string) => {
      const confirmed = window.confirm('Are you sure you want to delete this slide deck?');
      if (confirmed) {
        await deleteSlideDeck({ slideDeckId });
      }
    },
    [deleteSlideDeck]
  );

  return { handleView, handleDelete };
};
