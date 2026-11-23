import { createContext } from 'react';
import type { IWelcomePageContext } from '../types/IWelcomePageContext';

export const WelcomePageContext = createContext<IWelcomePageContext | undefined>(
  undefined,
);
