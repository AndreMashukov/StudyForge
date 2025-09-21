export interface IUrlScrapingFormData {
  url: string;
  title?: string;
}

export interface IUrlScrapingFormProps {
  isLoading: boolean;
  onSubmit: (data: IUrlScrapingFormData) => void;
}