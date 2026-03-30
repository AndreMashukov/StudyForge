import { useContext } from 'react';
import { DiagramQuizPageContext } from '../DiagramQuizPageContext';

export const useDiagramQuizPageContext = () => {
  const ctx = useContext(DiagramQuizPageContext);
  if (!ctx) {
    throw new Error('useDiagramQuizPageContext must be used within DiagramQuizPageProvider');
  }
  return ctx;
};
