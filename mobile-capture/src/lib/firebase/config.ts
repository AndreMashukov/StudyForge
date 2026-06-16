import Constants from 'expo-constants';
import { Platform } from 'react-native';

function readExtraEnv(): Record<string, string> {
  const extra = Constants.expoConfig?.extra;
  if (!extra || typeof extra !== 'object') {
    return {};
  }

  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (typeof value === 'string') {
      values[key] = value;
    }
  }
  return values;
}

const extraEnv = readExtraEnv();

function env(key: string, fallback = ''): string {
  if (extraEnv[key]) {
    return extraEnv[key];
  }
  const fromProcess = process.env[key];
  if (fromProcess) {
    return fromProcess;
  }
  return fallback;
}

export interface IFirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const DEMO_FIREBASE_PROJECT_ID = 'demo-project';

export function getFirebasePublicConfig(): IFirebasePublicConfig {
  return {
    apiKey: env('NX_PUBLIC_FIREBASE_API_KEY', 'demo-api-key-for-emulator'),
    authDomain: env(
      'NX_PUBLIC_FIREBASE_AUTH_DOMAIN',
      `${DEMO_FIREBASE_PROJECT_ID}.firebaseapp.com`
    ),
    projectId: env('NX_PUBLIC_FIREBASE_PROJECT_ID', DEMO_FIREBASE_PROJECT_ID),
    storageBucket: env(
      'NX_PUBLIC_FIREBASE_STORAGE_BUCKET',
      `${DEMO_FIREBASE_PROJECT_ID}.appspot.com`
    ),
    messagingSenderId: env('NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', '123456789012'),
    appId: env('NX_PUBLIC_FIREBASE_APP_ID', '1:123456789012:web:demo-app-id'),
  };
}

export function useFirebaseEmulator(): boolean {
  return env('NX_PUBLIC_USE_FIREBASE_EMULATOR') === 'true';
}

export function getEmulatorHost(): string {
  return Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
}

export const FIREBASE_FUNCTIONS_REGION = 'asia-east1';
