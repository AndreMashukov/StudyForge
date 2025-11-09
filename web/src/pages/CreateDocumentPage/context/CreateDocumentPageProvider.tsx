import React, { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { CreateDocumentPageContext } from './CreateDocumentPageContext';
import { ICreateDocumentPageContext } from '../types/ICreateDocumentPageContext';
import { useCreateDocumentPageHandlers } from './hooks/useCreateDocumentPageHandlers';
import { selectSelectedDirectoryId } from '../../../store/slices/directorySlice';
import type { RootState } from '../../../store';

interface CreateDocumentPageProviderProps {
  children: React.ReactNode;
}

export const CreateDocumentPageProvider: React.FC<CreateDocumentPageProviderProps> = ({ children }) => {
  // Get directoryId from global directory selection
  const directoryId = useSelector((state: RootState) => selectSelectedDirectoryId(state));
  
  // Local state for selected rule IDs
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  
  // Handler for rule changes
  const handleRuleIdsChange = useCallback((ruleIds: string[]) => {
    setSelectedRuleIds(ruleIds);
  }, []);
  
  // Handler hooks - self-contained business logic
  const handlers = useCreateDocumentPageHandlers();

  const contextValue: ICreateDocumentPageContext = {
    handlers: {
      ...handlers,
      handleRuleIdsChange,
    },
    directoryId,
    selectedRuleIds,
  };

  return (
    <CreateDocumentPageContext.Provider value={contextValue}>
      {children}
    </CreateDocumentPageContext.Provider>
  );
};