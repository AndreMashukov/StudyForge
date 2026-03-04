import React from 'react';
import { IFlashcardsPageContext } from '../types/IFlashcardsPageContext';

export const FlashcardsPageContext = React.createContext<IFlashcardsPageContext | undefined>(undefined);
