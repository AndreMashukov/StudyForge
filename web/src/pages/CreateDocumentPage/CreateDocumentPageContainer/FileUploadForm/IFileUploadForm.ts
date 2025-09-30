export interface IFileUploadFormData {
  file: File;
  title?: string;
}

export interface IFileUploadFormProps {
  isLoading: boolean;
  onSubmit: (data: IFileUploadFormData) => void;
}