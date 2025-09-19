import { createContext } from 'react';
import { IQuizPageContext } from '../types/IQuizPageContext';

export const QuizPageContext = createContext<IQuizPageContext | undefined>(undefined);