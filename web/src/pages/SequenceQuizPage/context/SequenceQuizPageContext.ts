import { createContext } from 'react';
import { ISequenceQuizPageContext } from '../types/ISequenceQuizPageContext';

export const SequenceQuizPageContext = createContext<ISequenceQuizPageContext | undefined>(undefined);
