import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rule } from '@shared-types';
import { useDeleteRuleMutation } from '../../../../store/api/Rules';
import { useToast } from '../../../../components/Toast';

export const useRulesPageHandlers = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [deleteRule, { isLoading: isDeleting }] = useDeleteRuleMutation();

  const handleCreateRule = useCallback(() => {
    navigate('/rules/editor');
  }, [navigate]);

  const handleEditRule = useCallback((rule: Rule) => {
    navigate(`/rules/editor/${rule.id}`);
  }, [navigate]);

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

  return {
    handleCreateRule,
    handleEditRule,
    handleDeleteRule,
    isDeleting,
  };
};
