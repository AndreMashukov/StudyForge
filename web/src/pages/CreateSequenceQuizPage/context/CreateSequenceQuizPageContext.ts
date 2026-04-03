import { createContext } from 'react';
import { ICreateSequenceQuizPageContext } from '../types/ICreateSequenceQuizPageContext';

export const CreateSequenceQuizPageContext = createContext<
  ICreateSequenceQuizPageContext | undefined
>(undefined);
