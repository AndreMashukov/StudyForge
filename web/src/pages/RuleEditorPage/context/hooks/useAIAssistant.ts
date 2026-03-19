import { useRuleEditorContext } from '../RuleEditorContext';

export const useAIAssistant = () => {
  const { aiState, aiResult, aiError, generateWithAI, applyAIResult, discardAIResult } =
    useRuleEditorContext();

  return {
    aiState,
    aiResult,
    aiError,
    generateWithAI,
    applyAIResult,
    discardAIResult,
  };
};
