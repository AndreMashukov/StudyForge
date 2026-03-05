import { createContext } from 'react';
import { ICreateFlashcardPageContext } from '../types/ICreateFlashcardPageContext';

export const CreateFlashcardPageContext = createContext<ICreateFlashcardPageContext | undefined>(undefined);
