import path from 'path';
import dotenv from 'dotenv';
import { ExpoConfig, ConfigContext } from 'expo/config';

const workspaceRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(workspaceRoot, '.env') });
dotenv.config({ path: path.join(workspaceRoot, '.env.mobile'), override: true });
dotenv.config({ path: path.join(workspaceRoot, '.env.dev'), override: true });
// Personal overrides last — must win over .env.dev / .env.mobile
dotenv.config({ path: path.join(workspaceRoot, '.env.local'), override: true });

const FIREBASE_PUBLIC_ENV_KEYS = [
  'NX_PUBLIC_FIREBASE_API_KEY',
  'NX_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NX_PUBLIC_FIREBASE_PROJECT_ID',
  'NX_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NX_PUBLIC_FIREBASE_APP_ID',
  'NX_PUBLIC_USE_FIREBASE_EMULATOR',
] as const;

function readFirebasePublicEnv(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const key of FIREBASE_PUBLIC_ENV_KEYS) {
    const value = process.env[key];
    if (value) {
      values[key] = value;
    }
  }
  return values;
}

const firebasePublicEnv = readFirebasePublicEnv();
const projectId =
  firebasePublicEnv.NX_PUBLIC_FIREBASE_PROJECT_ID ?? 'study-forge-202604';

const OBSIDIAN_PULSE_BACKGROUND = '#121414';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'StudyForge Capture',
  slug: 'studyforge-capture',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'studyforge',
  userInterfaceStyle: 'dark',
  backgroundColor: OBSIDIAN_PULSE_BACKGROUND,
  androidStatusBar: {
    barStyle: 'light-content',
    backgroundColor: OBSIDIAN_PULSE_BACKGROUND,
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'io.studyforge.capture',
    infoPlist: {
      NSCameraUsageDescription:
        'StudyForge needs camera access to scan documents and send them to your library.',
    },
  },
  android: {
    package: 'io.studyforge.capture',
    permissions: ['android.permission.CAMERA'],
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow StudyForge to capture documents with your camera.',
      },
    ],
    'expo-ocr-kit',
  ],
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
    firebaseProjectId: projectId,
    ...firebasePublicEnv,
  },
});
