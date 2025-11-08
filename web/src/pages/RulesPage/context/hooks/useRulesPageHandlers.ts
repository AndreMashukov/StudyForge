import { useCallback, useState } from 'react';
import { Rule } from '@shared-types';
import { useDeleteRuleMutation } from '../../../../store/api/Rules';
import { useToast } from '../../../../components/Toast';

export const useRulesPageHandlers = () => {
  const { showToast } = useToast();
  const [deleteRule, { isLoading: isDeleting }] = useDeleteRuleMutation();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);

  const handleCreateRule = useCallback(() => {
    setSelectedRule(null);
    setIsCreateModalOpen(true);
  }, []);

  const handleEditRule = useCallback((rule: Rule) => {
    setSelectedRule(rule);
    setIsEditModalOpen(true);
  }, []);

  const handleDeleteRule = useCallback(async (ruleId: string) => {
    try {
      const result = await deleteRule({ ruleId }).unwrap();
      
      if (result.success) {
        showToast('Rule deleted successfully', 'success');
      } else {
        showToast(result.error || 'Failed to delete rule', 'error');
      }
    } catch (error) {
      const errorMessage = error && typeof error === 'object' && 'data' in error && 
        typeof error.data === 'object' && error.data && 'error' in error.data && 
        typeof error.data.error === 'string'
        ? error.data.error 
        : 'Failed to delete rule';
      
      showToast(errorMessage, 'error');
    }
  }, [deleteRule, showToast]);

  const handleCloseCreateModal = useCallback(() => {
    setIsCreateModalOpen(false);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedRule(null);
  }, []);

  return {
    handleCreateRule,
    handleEditRule,
    handleDeleteRule,
    isDeleting,
    isCreateModalOpen,
    isEditModalOpen,
    selectedRule,
    handleCloseCreateModal,
    handleCloseEditModal,
  };
};
