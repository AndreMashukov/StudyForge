// Form data interface for React Hook Form
export interface ICreateQuizFormData {
  documentId: string;
  quizName: string;
  additionalPrompt: string;
}

// Note: Form state is handled by React Hook Form, not Redux
// This file exists to export form interfaces for type safety