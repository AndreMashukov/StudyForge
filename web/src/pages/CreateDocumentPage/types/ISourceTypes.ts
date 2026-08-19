export type SourceType = 'website' | 'file' | 'pasteText' | 'textPrompt';

export type SourceStatus = 'active' | 'coming-soon' | 'disabled';

export interface ISourceCard {
  id: SourceType;
  icon: string;
  title: string;
  description: string;
  status: SourceStatus;
  order: number;
}

export interface ISourceListItem {
  id: SourceType;
  icon: string;
  title: string;
  description: string;
  status: SourceStatus;
}
