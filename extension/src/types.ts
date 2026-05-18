export const CAPTURE_SCREENSHOT_COMMAND = 'capture-screenshot';

export const DEFAULT_API_BASE_URL = 'https://asia-east1-studyforge.cloudfunctions.net/api';
export const DEFAULT_APP_BASE_URL = 'https://studyforge.io';

export interface ExtensionSettings {
  apiKey: string;
  apiBaseUrl: string;
  appBaseUrl: string;
  directoryMappings: Record<string, string>;
}

export interface CommandShortcut {
  name?: string;
  description?: string;
  shortcut?: string;
}

export interface GenerateFromScreenshotResult {
  documentId: string;
  title: string;
  content?: string;
  wordCount?: number;
  metadata?: {
    generatedAt: string;
    sourceType: 'screenshot';
    directoryId: string;
  };
}

export interface GenerateFromScreenshotParams {
  apiBaseUrl: string;
  apiKey: string;
  directoryId: string;
  imageBase64: string;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  apiKey: '',
  apiBaseUrl: DEFAULT_API_BASE_URL,
  appBaseUrl: DEFAULT_APP_BASE_URL,
  directoryMappings: {
    [CAPTURE_SCREENSHOT_COMMAND]: '',
  },
};

export type CaptureState = 'idle' | 'validating' | 'capturing' | 'uploading' | 'success' | 'error';