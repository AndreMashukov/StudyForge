export interface ITextPromptFormData {
  prompt: string;
  ruleIds?: string[];
}

export interface ITextPromptFormProps {
  onSubmit: (data: ITextPromptFormData) => void;
}
