import { RuleColor, RuleApplicability } from "@shared-types";


export interface IRuleEditorFormData {
  name: string;
  description: string;
  content: string;
  color: RuleColor;
  tags: string[];
  applicableTo: RuleApplicability[];
  isDefault: boolean;
}

export interface IAIResult {
  name: string;
  description: string;
  content: string;
}

export type AIState = 'idle' | 'generating' | 'done' | 'error';

export interface IRuleEditorContext {
  mode: 'create' | 'edit';
  ruleId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  formData: IRuleEditorFormData;
  formErrors: Record<string, string>;
  updateField: (field: keyof IRuleEditorFormData, value: IRuleEditorFormData[keyof IRuleEditorFormData]) => void;
  save: () => Promise<void>;
  deleteRule: () => Promise<void>;
  aiState: AIState;
  aiResult: IAIResult | null;
  aiError: string | null;
  generateWithAI: (topic: string, description?: string) => Promise<void>;
  applyAIResult: () => void;
  discardAIResult: () => void;
}
