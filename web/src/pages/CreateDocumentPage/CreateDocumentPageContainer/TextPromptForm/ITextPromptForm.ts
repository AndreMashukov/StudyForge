export interface ITextPromptFormData {
  prompt: string;
  ruleIds?: string[];
  includeDiagrams?: boolean;
  diagramCount?: number;
  includeScratchPads?: boolean;
}

export interface ITextPromptFormProps {
  onSubmit: (data: ITextPromptFormData) => void;
}
