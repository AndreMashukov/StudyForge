export interface ITextPromptFormData {
  prompt: string;
  ruleIds?: string[];
  includeDiagrams?: boolean;
  diagramCount?: number;
}

export interface ITextPromptFormProps {
  onSubmit: (data: ITextPromptFormData) => void;
}
