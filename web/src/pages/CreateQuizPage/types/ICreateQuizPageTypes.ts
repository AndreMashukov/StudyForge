// Form data interface for React Hook Form
export interface ICreateQuizFormData {
  documentIds: string[];
  quizName?: string;
  additionalPrompt?: string;
  ruleIds?: string[];
  quizRuleIds?: string[];
  followupRuleIds?: string[];
}
