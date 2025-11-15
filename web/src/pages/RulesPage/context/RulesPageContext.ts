import { createContext } from 'react';
import { IRulesPageContext } from '../types/IRulesPageContext';

export const RulesPageContext = createContext<IRulesPageContext | undefined>(undefined);
