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

export function getFirebasePublicConfig(): IFirebasePublicConfig {
  return {
    apiKey: env('NX_PUBLIC_FIREBASE_API_KEY', 'demo-api-key-for-emulator'),
    authDomain: env('NX_PUBLIC_FIREBASE_AUTH_DOMAIN', 'study-forge-202604.firebaseapp.com'),
    projectId: env('NX_PUBLIC_FIREBASE_PROJECT_ID', 'study-forge-202604'),
    storageBucket: env('NX_PUBLIC_FIREBASE_STORAGE_BUCKET', 'study-forge-202604.firebasestorage.app'),
    messagingSenderId: env('NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', '853327102927'),
    appId: env('NX_PUBLIC_FIREBASE_APP_ID', '1:853327102927:web:4a3444a27948fac44088ba'),
  };
}

export function useFirebaseEmulator(): boolean {
  return env('NX_PUBLIC_USE_FIREBASE_EMULATOR') === 'true';
}

export function getEmulatorHost(): string {
  return Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
}

export const FIREBASE_FUNCTIONS_REGION = 'asia-east1';
