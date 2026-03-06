import { useParams } from 'react-router-dom';
import { useGetSlideDeckQuery } from '../../../../../store/api/SlideDecks/SlideDecksApi';
import { ISlideDeckPageApiState } from '../../../types/ISlideDeckPageContext';

export const useFetchSlideDeckData = (): ISlideDeckPageApiState => {
  const { slideDeckId } = useParams<{ slideDeckId: string }>();

  const { data: response, isLoading, error } = useGetSlideDeckQuery(
    { slideDeckId: slideDeckId || '' },
    { skip: !slideDeckId }
  );

  return {
    slideDeck: response?.data,
    isLoading,
    error,
  };
};
