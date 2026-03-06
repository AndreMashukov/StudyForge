import { createContext } from 'react';
import { ISlideDecksPageContext } from '../types/ISlideDecksPageContext';

export const SlideDecksPageContext = createContext<ISlideDecksPageContext | null>(null);
