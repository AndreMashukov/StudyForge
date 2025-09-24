import { createContext } from 'react';
import { ICreateQuizPageContext } from '../types/ICreateQuizPageContext';

export const CreateQuizPageContext = createContext<ICreateQuizPageContext | undefined>(undefined);