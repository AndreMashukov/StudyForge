export type SourceType = 'website' | 'file' | 'textPrompt';

export type SourceStatus = 'active' | 'coming-soon' | 'disabled';

export interface ISourceCard {
  id: SourceType;
  icon: string;
  title: string;
  description: string;
  status: SourceStatus;
  order: number;
}
