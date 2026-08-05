import React, { createContext, useContext, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RuleColor, CreateRuleRequest } from '@shared-types';
import {
  useCreateRuleMutation,
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
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [createRule, { isLoading: isCreating }] = useCreateRuleMutation();
  const [generateRuleWithAI] = useGenerateRuleWithAIMutation();

  const [formData, setFormData] = useState<IRuleEditorFormData>(DEFAULT_FORM_DATA);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [aiState, setAiState] = useState<AIState>('idle');
  const [aiResult, setAiResult] = useState<IAIResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

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
      await createRule(formData as CreateRuleRequest).unwrap();
      showToast(`Rule "${formData.name}" created successfully`, 'success');
      navigate('/rules');
    } catch {
      // Error is shown via the global errorToastMiddleware toast
    }
  }, [formData, validate, showToast, navigate, createRule]);

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
    isSaving: isCreating,
    formData,
    formErrors,
    updateField,
    save,
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
