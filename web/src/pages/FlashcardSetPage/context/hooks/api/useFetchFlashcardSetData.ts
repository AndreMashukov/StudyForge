import { useParams } from 'react-router-dom';
import { useGetFlashcardSetQuery } from '../../../../../store/api/Flashcards/FlashcardsApi';
import { IFlashcardSetPageApiState } from '../../../types/IFlashcardSetPageContext';

export const useFetchFlashcardSetData = (): IFlashcardSetPageApiState => {
  const { flashcardSetId } = useParams<{ flashcardSetId: string }>();
  const { data: flashcardSetResponse, error, isLoading } = useGetFlashcardSetQuery(
    { flashcardSetId: flashcardSetId ?? '' },
    { skip: !flashcardSetId }
  );
  const flashcardSet = flashcardSetResponse?.success ? flashcardSetResponse.data : undefined;

  return { flashcardSet, isLoading, error };
};
