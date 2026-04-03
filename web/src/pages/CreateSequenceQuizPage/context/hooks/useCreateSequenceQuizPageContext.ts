import { useContext } from 'react';
import { CreateSequenceQuizPageContext } from '../CreateSequenceQuizPageContext';

export const useCreateSequenceQuizPageContext = () => {
  const ctx = useContext(CreateSequenceQuizPageContext);
  if (!ctx) {
    throw new Error(
      'useCreateSequenceQuizPageContext must be used within CreateSequenceQuizPageProvider'
    );
  }
  return ctx;
};
