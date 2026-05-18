import { defineManifest } from '@crxjs/vite-plugin';
import { CAPTURE_COMMANDS, DEFAULT_API_BASE_URL } from './src/types';

const DEFAULT_API_HOST_PERMISSION = `${new URL(DEFAULT_API_BASE_URL).origin}/*`;
const commands = CAPTURE_COMMANDS.reduce<Record<string, { description: string; suggested_key?: { default: string; mac: string } }>>(
  (items, command) => {
    const suggestedKey = 'suggestedKey' in command ? command.suggestedKey : undefined;

    return {
      ...items,
      [command.id]: {
        description: command.description,
        ...(suggestedKey ? { suggested_key: { ...suggestedKey } } : {}),
      },
    };
  },
  {}
);

export default defineManifest({
  manifest_version: 3,
  name: 'StudyForge Capture',
  version: '0.1.0',
  description: 'Capture browser viewport screenshots and create StudyForge documents.',
  action: {
    default_title: 'StudyForge Capture',
    default_popup: 'src/popup/index.html',
  },
  background: {
    service_worker: 'src/background/main.ts',
    type: 'module',
  },
  permissions: ['activeTab', 'commands', 'storage', 'tabs'],
  host_permissions: [DEFAULT_API_HOST_PERMISSION],
  optional_host_permissions: ['https://*/*', 'http://*/*'],
  icons: {
    16: 'icons/icon-16.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  commands,
});