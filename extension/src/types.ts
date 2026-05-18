export const CAPTURE_SCREENSHOT_COMMAND = 'capture-screenshot';

export interface CaptureCommandConfig {
  id: string;
  label: string;
  description: string;
  suggestedKey?: {
    default: string;
    mac: string;
  };
}

export const CAPTURE_COMMANDS = [
  {
    id: CAPTURE_SCREENSHOT_COMMAND,
    label: 'Capture 1',
    description: 'Capture viewport to StudyForge directory 1',
    suggestedKey: {
      default: 'Ctrl+Shift+S',
      mac: 'Command+Shift+S',
    },
  },
  {
    id: 'capture-screenshot-2',
    label: 'Capture 2',
    description: 'Capture viewport to StudyForge directory 2',
  },
  {
    id: 'capture-screenshot-3',
    label: 'Capture 3',
    description: 'Capture viewport to StudyForge directory 3',
  },
  {
    id: 'capture-screenshot-4',
    label: 'Capture 4',
    description: 'Capture viewport to StudyForge directory 4',
  },
  {
    id: 'capture-screenshot-5',
    label: 'Capture 5',
    description: 'Capture viewport to StudyForge directory 5',
  },
  {
    id: 'capture-screenshot-6',
    label: 'Capture 6',
    description: 'Capture viewport to StudyForge directory 6',
  },
  {
    id: 'capture-screenshot-7',
    label: 'Capture 7',
    description: 'Capture viewport to StudyForge directory 7',
  },
  {
    id: 'capture-screenshot-8',
    label: 'Capture 8',
    description: 'Capture viewport to StudyForge directory 8',
  },
] as const satisfies readonly CaptureCommandConfig[];

export type CaptureCommandId = (typeof CAPTURE_COMMANDS)[number]['id'];

export const CAPTURE_COMMAND_IDS: CaptureCommandId[] = CAPTURE_COMMANDS.map((command) => command.id);

export const DEFAULT_DIRECTORY_MAPPINGS: Record<string, string> = CAPTURE_COMMAND_IDS.reduce<Record<string, string>>(
  (mappings, commandId) => ({
    ...mappings,
    [commandId]: '',
  }),
  {}
);

export function isCaptureCommand(command: string): command is CaptureCommandId {
  return CAPTURE_COMMAND_IDS.includes(command as CaptureCommandId);
}

export const DEFAULT_API_BASE_URL = 'https://asia-east1-study-forge-202604.cloudfunctions.net/api';
export const DEFAULT_APP_BASE_URL = 'https://studyforge.io';
export const DEBUG_LOG_STORAGE_KEY = 'debugLog';

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

export interface DebugLogEntry {
  timestamp: string;
  level: 'info' | 'error';
  message: string;
  details?: string;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  apiKey: '',
  apiBaseUrl: DEFAULT_API_BASE_URL,
  appBaseUrl: DEFAULT_APP_BASE_URL,
  directoryMappings: DEFAULT_DIRECTORY_MAPPINGS,
};

export type CaptureState = 'idle' | 'validating' | 'capturing' | 'uploading' | 'success' | 'error';