import { useRuleEditorContext } from '../RuleEditorContext';

export const useRuleEditorForm = () => {
  const { formData, formErrors, updateField } = useRuleEditorContext();

  return {
    formData,
    formErrors,
    updateField,
  };
};
