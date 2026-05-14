export interface IUrlScrapingFormData {
  urls: string[];
  title?: string;
  ruleIds?: string[];
}

export interface IUrlScrapingFormProps {
  isLoading: boolean;
  onSubmit: (data: IUrlScrapingFormData) => void;
}