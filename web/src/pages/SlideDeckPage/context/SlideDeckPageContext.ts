import { createContext } from 'react';
import { ISlideDeckPageContext } from '../types/ISlideDeckPageContext';

export const SlideDeckPageContext = createContext<ISlideDeckPageContext | null>(null);
