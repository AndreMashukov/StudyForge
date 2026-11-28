export interface IMarkdownRenderer {
  content: string;
  className?: string;
  showToc?: boolean;
  onTocGenerated?: (toc: TocItem[]) => void;
  /** Renders $…$ / $$…$$ formulas and ```plotly plots (Workspace agent replies). */
  richContent?: boolean;
  /** While text is still streaming in, shows placeholders for diagrams and plots. */
  deferRichBlocks?: boolean;
}

export interface TocItem {
  id: string;
  title: string;
  level: number;
  children?: TocItem[];
}