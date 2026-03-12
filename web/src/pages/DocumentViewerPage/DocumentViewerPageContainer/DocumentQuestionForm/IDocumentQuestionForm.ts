export interface IDocumentQuestionForm {
  onSubmit: (question: string) => void;
  isLoading: boolean;
  answer: string | null;
  error: string | null;
}
