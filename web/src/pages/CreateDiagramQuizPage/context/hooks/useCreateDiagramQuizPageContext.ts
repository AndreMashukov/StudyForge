import { useContext } from 'react';
import { CreateDiagramQuizPageContext } from '../CreateDiagramQuizPageContext';

export const useCreateDiagramQuizPageContext = () => {
  const ctx = useContext(CreateDiagramQuizPageContext);
  if (!ctx) {
    throw new Error(
      'useCreateDiagramQuizPageContext must be used within CreateDiagramQuizPageProvider'
    );
  }
  return ctx;
};
