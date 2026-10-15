export interface ITextPromptFormData {
  prompt: string;
  ruleIds?: string[];
  includeDiagrams?: boolean;
}

export interface ITextPromptFormProps {
  onSubmit: (data: ITextPromptFormData) => void;
}
