export type SourceType = 'website' | 'file' | 'textPrompt' | 'videoUrl';

export type SourceStatus = 'active' | 'coming-soon' | 'disabled';

export interface ISourceCard {
  id: SourceType;
  icon: string;
  title: string;
  description: string;
  status: SourceStatus;
  order: number;
}

export interface ISourceFormData {
  sourceType: SourceType;
  data: IUrlFormData | IFileFormData | ITextPromptFormData | IVideoUrlFormData;
}

export interface IUrlFormData {
  url: string;
  title?: string;
}

export interface IFileFormData {
  file: File;
  title?: string;
}

// Future source types (for phase 7)
export interface ITextPromptFormData {
  title: string;
  description: string;
  options?: {
    includeToc?: boolean;
    includeExamples?: boolean;
    length?: 'short' | 'medium' | 'long';
  };
}

export interface IVideoUrlFormData {
  url: string;
  platform?: 'youtube' | 'vimeo';
  extractionMethod?: 'full' | 'keyPoints' | 'summary';
  options?: {
    includeTimestamps?: boolean;
    includeSpeakerNames?: boolean;
    includeDescription?: boolean;
  };
}