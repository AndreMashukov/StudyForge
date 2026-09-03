import { createContext } from 'react';
import { IMatchQuizPageContext } from '../types/IMatchQuizPageContext';

export const MatchQuizPageContext = createContext<IMatchQuizPageContext | undefined>(undefined);