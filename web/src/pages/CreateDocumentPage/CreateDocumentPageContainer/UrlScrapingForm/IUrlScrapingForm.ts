export interface IUrlScrapingFormData {
  url: string;
  title?: string;
  ruleIds?: string[]; // Optional rules for content scraping (Section 6)
}

export interface IUrlScrapingFormProps {
  isLoading: boolean;
  onSubmit: (data: IUrlScrapingFormData) => void;
}