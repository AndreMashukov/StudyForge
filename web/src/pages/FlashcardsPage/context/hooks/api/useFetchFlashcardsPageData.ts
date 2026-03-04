import { useGetUserFlashcardSetsQuery } from '../../../../../store/api/Flashcards/FlashcardsApi';
import { IFlashcardsPageApiState } from '../../../types/IFlashcardsPageContext';

export const useFetchFlashcardsPageData = (): IFlashcardsPageApiState => {
  const { data: flashcardSetsResponse, error, isLoading, isFetching } = useGetUserFlashcardSetsQuery();
  const flashcardSets = flashcardSetsResponse?.success ? flashcardSetsResponse.data : undefined;

  return { flashcardSets, isLoading, isFetching, error };
};
