import { createContext } from 'react';
import { IMyQuizzesPageContext } from '../types/IMyQuizzesPageTypes';

export const MyQuizzesPageContext = createContext<IMyQuizzesPageContext | null>(null);