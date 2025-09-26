import { TocItem } from '../IMarkdownRenderer';

export interface ITableOfContents {
  items: TocItem[];
  className?: string;
  activeId?: string;
  onItemClick?: (id: string) => void;
}