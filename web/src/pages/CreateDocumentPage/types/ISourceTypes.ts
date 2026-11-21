import type { LucideIcon } from 'lucide-react';

export type SourceType = 'website' | 'file' | 'pasteText' | 'textPrompt';

export type SourceStatus = 'active' | 'coming-soon' | 'disabled';

export interface ISourceCard {
  id: SourceType;
  icon: LucideIcon;
  title: string;
  description: string;
  status: SourceStatus;
  order: number;
}

export interface ISourceListItem {
  id: SourceType;
  icon: LucideIcon;
  title: string;
  description: string;
  status: SourceStatus;
}
