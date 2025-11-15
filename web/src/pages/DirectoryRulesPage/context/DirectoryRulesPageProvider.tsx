import { ReactNode, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DirectoryRulesPageContext } from './DirectoryRulesPageContext';
import { IDirectoryRulesPageContext } from '../types/IDirectoryRulesPageContext';
import { 
  useGetDirectoryRulesQuery, 
  useDetachRuleFromDirectoryMutation 
} from '../../../store/api/Rules';
import { useGetDirectoryQuery } from '../../../store/api/Directory/DirectoryApi';
import { Rule } from '@shared-types';

interface DirectoryRulesPageProviderProps {
  children: ReactNode;
}

export const DirectoryRulesPageProvider = ({
  children,
}: DirectoryRulesPageProviderProps) => {
  const { directoryId } = useParams<{ directoryId: string }>();
  const navigate = useNavigate();
  
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCascadeViewOpen, setIsCascadeViewOpen] = useState(false);

  // Fetch directory details
  const { 
    data: directory, 
    isLoading: directoryLoading,
    error: directoryError 
  } = useGetDirectoryQuery(directoryId || '', {
    skip: !directoryId,
  });

  // Fetch directory rules with inheritance
  const { 
    data: rulesData, 
    isLoading: rulesLoading,
    error: rulesError 
  } = useGetDirectoryRulesQuery(
    { directoryId: directoryId || '', includeAncestors: true },
    { skip: !directoryId }
  );

  const [detachRuleFromDirectory] = useDetachRuleFromDirectoryMutation();

  // Extract direct and inherited rules
  const directRules: Rule[] = directoryId && rulesData?.inheritanceMap 
    ? rulesData.inheritanceMap[directoryId] || []
    : [];

  const inheritedRules: { [directoryId: string]: Rule[] } = 
    rulesData?.inheritanceMap || {};

  const allRules = rulesData?.rules || [];

  const loading = directoryLoading || rulesLoading;
  const error = directoryError || rulesError 
    ? 'Failed to load directory rules' 
    : null;

  const handleAssignRule = useCallback(() => {
    setIsAssignModalOpen(true);
  }, []);

  const handleRemoveRule = useCallback(
    async (ruleId: string) => {
      if (!directoryId) return;
      
      try {
        await detachRuleFromDirectory({
          ruleId,
          directoryId,
        }).unwrap();
      } catch (error) {
        console.error('Failed to remove rule from directory:', error);
      }
    },
    [directoryId, detachRuleFromDirectory]
  );

  const handleEditRule = useCallback(
    (ruleId: string) => {
      // Navigate to rules page with edit mode for this rule
      navigate(`/rules?edit=${ruleId}`);
    },
    [navigate]
  );

  const handleToggleCascadeView = useCallback(() => {
    setIsCascadeViewOpen((prev) => !prev);
  }, []);

  const handleCloseAssignModal = useCallback(() => {
    setIsAssignModalOpen(false);
  }, []);

  const contextValue: IDirectoryRulesPageContext = {
    state: {
      directoryId: directoryId || '',
      directory: directory || null,
      directRules,
      inheritedRules,
      allRules,
      loading,
      error,
      isAssignModalOpen,
      isCascadeViewOpen,
    },
    handlers: {
      handleAssignRule,
      handleRemoveRule,
      handleEditRule,
      handleToggleCascadeView,
      handleCloseAssignModal,
    },
  };

  return (
    <DirectoryRulesPageContext.Provider value={contextValue}>
      {children}
    </DirectoryRulesPageContext.Provider>
  );
};
