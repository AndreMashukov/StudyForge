import { defineManifest } from '@crxjs/vite-plugin';
import { DEFAULT_API_BASE_URL } from './src/types';

const DEFAULT_API_HOST_PERMISSION = `${new URL(DEFAULT_API_BASE_URL).origin}/*`;

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
  commands: {
    'capture-screenshot': {
      suggested_key: {
        default: 'Ctrl+Shift+S',
        mac: 'Command+Shift+S',
      },
      description: 'Capture viewport and create a StudyForge document',
    },
  },
});