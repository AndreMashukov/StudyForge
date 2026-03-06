import { useGetUserSlideDecksQuery } from '../../../../../store/api/SlideDecks/SlideDecksApi';
import { ISlideDecksPageApiState } from '../../../types/ISlideDecksPageContext';

export const useFetchSlideDecksData = (): ISlideDecksPageApiState => {
  const { data: response, isLoading, error } = useGetUserSlideDecksQuery();

  return {
    slideDecks: response?.data || [],
    isLoading,
    error,
  };
};
