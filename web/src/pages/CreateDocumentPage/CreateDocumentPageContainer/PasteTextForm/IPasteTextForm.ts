export interface IPasteTextFormData {
  content: string;
}

export interface IPasteTextFormProps {
  onSubmit: (data: IPasteTextFormData) => void;
}
