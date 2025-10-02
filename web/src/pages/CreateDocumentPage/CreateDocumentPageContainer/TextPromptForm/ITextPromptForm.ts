export interface ITextPromptFormData {
  prompt: string;
}

export interface ITextPromptFormProps {
  isLoading: boolean;
  progress?: number;
  onSubmit: (data: ITextPromptFormData) => void;
}

