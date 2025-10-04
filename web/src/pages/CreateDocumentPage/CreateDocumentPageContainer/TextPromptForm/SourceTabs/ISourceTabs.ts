/**
 * SourceTabs Component Interface
 * Tab navigation between Upload Files and Library Documents
 */

export type SourceTabType = 'upload' | 'library';

export interface ISourceTabs {
  activeTab: SourceTabType;
  onTabChange: (tab: SourceTabType) => void;
  uploadCount: number;
  libraryCount: number;
  disabled?: boolean;
}

