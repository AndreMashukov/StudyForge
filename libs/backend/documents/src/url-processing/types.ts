export type UrlSourceType = 'web' | 'youtube';

export interface UrlProcessingInput {
  url: string;
  ruleIds?: string[];
  userId?: string;
}

export interface UrlProcessingResult {
  url: string;
  type: UrlSourceType;
  title: string;
  markdownContent: string;
  wordCount: number;
  error?: string;
}

export interface UrlProcessingSummary {
  results: UrlProcessingResult[];
  mergedMarkdown: string;
  totalWordCount: number;
  sourceUrls: string[];
  successfulCount: number;
  failedCount: number;
}

/**
 * Strategy interface for URL source processors.
 * Each processor handles one URL source type (web, YouTube, etc.).
 * Register new processors in the UrlProcessingOrchestrator to support new sources.
 */
export interface UrlSourceProcessor {
  readonly type: UrlSourceType;
  canProcess(url: URL): boolean;
  process(input: UrlProcessingInput): Promise<UrlProcessingResult>;
}
