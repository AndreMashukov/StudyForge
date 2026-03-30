import { createContext } from 'react';
import { IDiagramQuizPageContext } from '../types/IDiagramQuizPageContext';

export const DiagramQuizPageContext = createContext<IDiagramQuizPageContext | undefined>(undefined);
