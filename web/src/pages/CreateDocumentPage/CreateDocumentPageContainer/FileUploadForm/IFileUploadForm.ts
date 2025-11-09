export interface IFileUploadFormData {
  file: File;
  title?: string;
  ruleIds?: string[]; // Optional rules for content upload (Section 6)
}

export interface IFileUploadFormProps {
  isLoading: boolean;
  onSubmit: (data: IFileUploadFormData) => void;
}