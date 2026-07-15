export interface IUrlScrapingFormData {
  urls: string[];
  title?: string;
  ruleIds?: string[];
}

export interface IUrlScrapingFormProps {
  onSubmit: (data: IUrlScrapingFormData) => void;
}
