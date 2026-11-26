import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { RuleColor, CreateRuleRequest } from '@shared-types';
import {
  useGetRuleQuery,
  useCreateRuleMutation,
  useUpdateRuleMutation,
  useDeleteRuleMutation,
  useGenerateRuleWithAIMutation,
} from '../../../store/api/Rules/rulesApi';
import { useToast } from '../../../components/Toast';
import { useAppDispatch } from '../../../hooks/redux';
import { setLoading } from '../../../store/slices/uiSlice';
import {
  IRuleEditorContext,
  IRuleEditorFormData,
  AIState,
  IAIResult,
} from './IRuleEditorContext';
import { resolveRuleEditorReturnPath } from '../utils/ruleEditorReturnPath';

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
};

export const RuleEditorProvider: React.FC<RuleEditorProviderProps> = ({ children }) => {
  const { ruleId } = useParams<{ ruleId?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnPath = resolveRuleEditorReturnPath(searchParams.get('directoryId'));
  const dispatch = useAppDispatch();
  const { showToast } = useToast();

  const mode: 'create' | 'edit' = ruleId ? 'edit' : 'create';

  const { data: existingRule, isLoading: isLoadingRule } = useGetRuleQuery(ruleId ?? '', {
    skip: !ruleId,
  });

  const [createRule, { isLoading: isCreating }] = useCreateRuleMutation();
  const [updateRule, { isLoading: isUpdating }] = useUpdateRuleMutation();
  const [deleteRuleMutation] = useDeleteRuleMutation();
  const [generateRuleWithAI] = useGenerateRuleWithAIMutation();

  const [formData, setFormData] = useState<IRuleEditorFormData>(DEFAULT_FORM_DATA);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [aiState, setAiState] = useState<AIState>('idle');
  const [aiResult, setAiResult] = useState<IAIResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (existingRule && mode === 'edit') {
      setFormData({
        name: existingRule.name,
        description: existingRule.description || '',
        content: existingRule.content,
        color: existingRule.color,
        tags: [...existingRule.tags],
        applicableTo: [...existingRule.applicableTo],
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

    // Call-site overlay: keep updateRule/createRule off the RTK allowlist so
    // always-apply toggles in create flows stay non-blocking.
    dispatch(setLoading({ isLoading: true, message: 'Saving prompt…' }));
    try {
      if (mode === 'edit' && ruleId) {
        await updateRule({ ruleId, ...formData }).unwrap();
        showToast(`Prompt "${formData.name}" updated successfully`, 'success');
        navigate(returnPath);
      } else {
        await createRule(formData as CreateRuleRequest).unwrap();
        showToast(`Prompt "${formData.name}" created successfully`, 'success');
        navigate(returnPath);
      }
    } catch {
      // Error is shown via the global errorToastMiddleware toast
    } finally {
      dispatch(setLoading({ isLoading: false }));
    }
  }, [
    formData,
    mode,
    ruleId,
    validate,
    showToast,
    navigate,
    returnPath,
    updateRule,
    createRule,
    dispatch,
  ]);

  const deleteRule = useCallback(async () => {
    if (!ruleId) return;
    try {
      const result = await deleteRuleMutation({ ruleId }).unwrap();
      if (result.success) {
        showToast('Prompt deleted successfully', 'success');
        navigate(returnPath);
      } else {
        showToast(result.error || 'Failed to delete prompt', 'error');
      }
    } catch {
      // Error is shown via the global errorToastMiddleware toast
    }
  }, [ruleId, deleteRuleMutation, showToast, navigate, returnPath]);

  const generateWithAI = useCallback(
    async (topic: string, description?: string) => {
      if (mode === 'edit') return;

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
        setAiError('Failed to generate prompt with AI. Please try again.');
        setAiState('error');
      }
    },
    [generateRuleWithAI, formData.applicableTo, formData.content, mode]
  );

  const applyAIResult = useCallback(() => {
    if (!aiResult || mode === 'edit') return;
    setFormData((prev) => ({
      ...prev,
      name: aiResult.name || prev.name,
      description: aiResult.description || prev.description,
      content: aiResult.content || prev.content,
    }));
    setAiState('idle');
    setAiResult(null);
  }, [aiResult, mode]);

  const discardAIResult = useCallback(() => {
    setAiState('idle');
    setAiResult(null);
    setAiError(null);
  }, []);

  const contextValue: IRuleEditorContext = {
    mode,
    ruleId: ruleId ?? null,
    isLoading: isLoadingRule,
    isSaving: isCreating || isUpdating,
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
