import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RuleColor, CreateRuleRequest } from '@shared-types';
import {
  useGetRuleQuery,
  useCreateRuleMutation,
  useUpdateRuleMutation,
  useDeleteRuleMutation,
  useGenerateRuleWithAIMutation,
} from '../../../store/api/Rules/rulesApi';
import { useToast } from '../../../components/Toast';
import {
  IRuleEditorContext,
  IRuleEditorFormData,
  AIState,
  IAIResult,
} from './IRuleEditorContext';

const RuleEditorContext = createContext<IRuleEditorContext | undefined>(undefined);

interface RuleEditorProviderProps {
  children: React.ReactNode;
}

const DEFAULT_FORM_DATA: IRuleEditorFormData = {
  name: '',
  description: '',
  content: '',
  color: RuleColor.BLUE,
  tags: [],
  applicableTo: [],
  isDefault: false,
};

export const RuleEditorProvider: React.FC<RuleEditorProviderProps> = ({ children }) => {
  const { ruleId } = useParams<{ ruleId?: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const mode: 'create' | 'edit' = ruleId ? 'edit' : 'create';

  // Fetch existing rule in edit mode
  const { data: existingRule, isLoading: isLoadingRule } = useGetRuleQuery(ruleId ?? '', {
    skip: !ruleId,
  });

  // Mutations
  const [createRule, { isLoading: isCreating }] = useCreateRuleMutation();
  const [updateRule, { isLoading: isUpdating }] = useUpdateRuleMutation();
  const [deleteRuleMutation] = useDeleteRuleMutation();
  const [generateRuleWithAI, { isLoading: isGenerating }] = useGenerateRuleWithAIMutation();

  // Form state
  const [formData, setFormData] = useState<IRuleEditorFormData>(DEFAULT_FORM_DATA);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // AI state
  const [aiState, setAiState] = useState<AIState>('idle');
  const [aiResult, setAiResult] = useState<IAIResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Initialize form from existing rule in edit mode
  useEffect(() => {
    if (existingRule && mode === 'edit') {
      setFormData({
        name: existingRule.name,
        description: existingRule.description || '',
        content: existingRule.content,
        color: existingRule.color,
        tags: [...existingRule.tags],
        applicableTo: [...existingRule.applicableTo],
        isDefault: existingRule.isDefault,
      });
    }
  }, [existingRule, mode]);

  const updateField = useCallback(
    (field: keyof IRuleEditorFormData, value: IRuleEditorFormData[keyof IRuleEditorFormData]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setFormErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    []
  );

  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.length > 100) {
      errors.name = 'Name must be 100 characters or less';
    }
    if (!formData.content.trim()) {
      errors.content = 'Content is required';
    } else if (formData.content.length > 100000) {
      errors.content = 'Content must be 100,000 characters or less';
    }
    if (formData.applicableTo.length < 1) {
      errors.applicableTo = 'Select at least one operation';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const save = useCallback(async () => {
    if (!validate()) {
      showToast('Please fix validation errors before saving', 'error');
      return;
    }
    try {
      if (mode === 'edit' && ruleId) {
        await updateRule({ ruleId, ...formData }).unwrap();
        showToast(`Rule "${formData.name}" updated successfully`, 'success');
      } else {
        await createRule(formData as CreateRuleRequest).unwrap();
        showToast(`Rule "${formData.name}" created successfully`, 'success');
        navigate('/rules');
      }
    } catch {
      const msg = `Failed to ${mode === 'edit' ? 'update' : 'create'} rule. Please try again.`;
      setFormErrors({ submit: msg });
      showToast(msg, 'error');
    }
  }, [formData, mode, ruleId, validate, showToast, navigate, updateRule, createRule]);

  const deleteRule = useCallback(async () => {
    if (!ruleId) return;
    try {
      const result = await deleteRuleMutation({ ruleId }).unwrap();
      if (result.success) {
        showToast('Rule deleted successfully', 'success');
        navigate('/rules');
      } else {
        showToast(result.error || 'Failed to delete rule', 'error');
      }
    } catch {
      showToast('Failed to delete rule', 'error');
    }
  }, [ruleId, deleteRuleMutation, showToast, navigate]);

  const generateWithAI = useCallback(
    async (topic: string, description?: string) => {
      setAiState('generating');
      setAiError(null);
      try {
        const result = await generateRuleWithAI({
          topic,
          description,
          applicableTo: formData.applicableTo.length > 0
            ? formData.applicableTo
            : undefined,
          existingContent: formData.content || undefined,
        }).unwrap();
        setAiResult(result);
        setAiState('done');
      } catch {
        setAiError('Failed to generate rule with AI. Please try again.');
        setAiState('error');
      }
    },
    [generateRuleWithAI, formData.applicableTo, formData.content]
  );

  const applyAIResult = useCallback(() => {
    if (!aiResult) return;
    setFormData((prev) => ({
      ...prev,
      name: aiResult.name || prev.name,
      description: aiResult.description || prev.description,
      content: aiResult.content || prev.content,
    }));
    setAiState('idle');
    setAiResult(null);
  }, [aiResult]);

  const discardAIResult = useCallback(() => {
    setAiState('idle');
    setAiResult(null);
    setAiError(null);
  }, []);

  const contextValue: IRuleEditorContext = {
    mode,
    ruleId: ruleId ?? null,
    isLoading: isLoadingRule,
    isSaving: isCreating || isUpdating || isGenerating,
    formData,
    formErrors,
    updateField,
    save,
    deleteRule,
    aiState,
    aiResult,
    aiError,
    generateWithAI,
    applyAIResult,
    discardAIResult,
  };

  return (
    <RuleEditorContext.Provider value={contextValue}>
      {children}
    </RuleEditorContext.Provider>
  );
};

export const useRuleEditorContext = (): IRuleEditorContext => {
  const context = useContext(RuleEditorContext);
  if (context === undefined) {
    throw new Error('useRuleEditorContext must be used within a RuleEditorProvider');
  }
  return context;
};
