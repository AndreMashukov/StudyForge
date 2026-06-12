import React from 'react';
import { IStatisticsPageContext } from '../types/IStatisticsPageContext';

export const StatisticsPageContext = React.createContext<IStatisticsPageContext | undefined>(undefined);
