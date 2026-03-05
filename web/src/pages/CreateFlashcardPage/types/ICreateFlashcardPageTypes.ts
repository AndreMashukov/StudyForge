export interface ICreateFlashcardFormData {
  documentId: string;
  flashcardName?: string;
  additionalPrompt?: string;
  ruleIds?: string[];
}
