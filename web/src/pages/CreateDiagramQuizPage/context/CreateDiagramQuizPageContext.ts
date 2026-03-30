import { createContext } from 'react';
import { ICreateDiagramQuizPageContext } from '../types/ICreateDiagramQuizPageContext';

export const CreateDiagramQuizPageContext = createContext<
  ICreateDiagramQuizPageContext | undefined
>(undefined);
