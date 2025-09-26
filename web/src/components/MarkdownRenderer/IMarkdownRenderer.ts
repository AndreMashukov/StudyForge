export interface IMarkdownRenderer {
  content: string;
  className?: string;
  showToc?: boolean;
  onTocGenerated?: (toc: TocItem[]) => void;
}

export interface TocItem {
  id: string;
  title: string;
  level: number;
  children?: TocItem[];
}