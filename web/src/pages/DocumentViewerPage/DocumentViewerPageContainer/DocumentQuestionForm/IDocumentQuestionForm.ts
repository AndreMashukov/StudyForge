export interface IDocumentQuestionForm {
  onSubmit: (question: string) => void;
  answer: string | null;
  error: string | null;
}
