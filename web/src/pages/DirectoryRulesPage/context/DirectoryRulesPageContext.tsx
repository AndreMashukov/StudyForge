import { createContext, useContext } from 'react';
import { IDirectoryRulesPageContext } from '../types/IDirectoryRulesPageContext';

export const DirectoryRulesPageContext = createContext<IDirectoryRulesPageContext | undefined>(
  undefined
);

export const useDirectoryRulesPage = () => {
  const context = useContext(DirectoryRulesPageContext);
  if (!context) {
    throw new Error(
      'useDirectoryRulesPage must be used within DirectoryRulesPageProvider'
    );
  }
  return context;
};
