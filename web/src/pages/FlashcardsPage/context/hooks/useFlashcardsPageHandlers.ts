import { useNavigate } from 'react-router-dom';
import { IFlashcardsPageHandlers } from '../../types/IFlashcardsPageContext';

export const useFlashcardsPageHandlers = (): IFlashcardsPageHandlers => {
  const navigate = useNavigate();

  const handleViewFlashcardSet = (id: string) => {
    navigate(`/flashcards/${id}`);
  };

  return { handleViewFlashcardSet };
};
