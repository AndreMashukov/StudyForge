// Form data interface for React Hook Form
export interface ICreateQuizFormData {
  documentId: string;
  quizName?: string;
  additionalPrompt?: string;
  quizRuleIds?: string[];
  followupRuleIds?: string[];
}