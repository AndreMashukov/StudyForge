import { createContext } from 'react';
import type { IUsagePageContext } from '../types/IUsagePageContext';

export const UsagePageContext = createContext<IUsagePageContext | undefined>(undefined);
