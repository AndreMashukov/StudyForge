import { createContext } from 'react';
import { ICreateSlideDeckPageContext } from '../types/ICreateSlideDeckPageContext';

export const CreateSlideDeckPageContext = createContext<ICreateSlideDeckPageContext | undefined>(undefined);
