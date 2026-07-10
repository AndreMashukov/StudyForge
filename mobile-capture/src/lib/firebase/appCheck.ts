import type { FirebaseApp } from 'firebase/app';
import {
  CustomProvider,
  initializeAppCheck as initializeJsAppCheck,
} from 'firebase/app-check';
import { getApp as getNativeApp } from '@react-native-firebase/app';
import {
  getToken,
  initializeAppCheck as initializeNativeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
} from '@react-native-firebase/app-check';
import { resolveAppCheckDebugToken, useFirebaseEmulator } from './config';

const DEFAULT_TOKEN_TTL_MS = 55 * 60 * 1000;

let appCheckReadyPromise: Promise<void> | undefined;
let appCheckInitialized = false;

function resolveUseDebugProvider(debugToken: string | undefined): boolean {
  // Sideloaded release APKs fail Play Integrity. A registered debug token opts into
  // the debug provider even when __DEV__ is false (e.g. assembleRelease installs).
  return __DEV__ || Boolean(debugToken);
}

function buildNativeAppCheckProvider(): ReactNativeFirebaseAppCheckProvider {
  const debugToken = resolveAppCheckDebugToken();
  const useDebugProvider = resolveUseDebugProvider(debugToken);
  const provider = new ReactNativeFirebaseAppCheckProvider();

  provider.configure({
    android: {
      provider: useDebugProvider ? 'debug' : 'playIntegrity',
      ...(debugToken ? { debugToken } : {}),
    },
    apple: {
      provider: useDebugProvider ? 'debug' : 'appAttestWithDeviceCheckFallback',
      ...(debugToken ? { debugToken } : {}),
    },
  });

  return provider;
}

function resolveExpireTimeMillis(token: string): number {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return Date.now() + DEFAULT_TOKEN_TTL_MS;
    }
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const parsed: unknown = JSON.parse(atob(padded));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'exp' in parsed &&
      typeof (parsed as { exp: unknown }).exp === 'number'
    ) {
      return (parsed as { exp: number }).exp * 1000;
    }
  } catch {
    // Fall through to default TTL when the JWT payload cannot be decoded.
  }
  return Date.now() + DEFAULT_TOKEN_TTL_MS;
}

/**
 * Native App Check (Play Integrity / App Attest / debug) lives on the RN Firebase app.
 * Callables use the JS Firebase SDK, so we bridge tokens via CustomProvider onto that app.
 */
export function initializeMobileAppCheck(jsApp: FirebaseApp): void {
  if (useFirebaseEmulator() || appCheckInitialized) {
    return;
  }
  appCheckInitialized = true;

  appCheckReadyPromise = (async () => {
    const nativeAppCheck = await initializeNativeAppCheck(getNativeApp(), {
      provider: buildNativeAppCheckProvider(),
      isTokenAutoRefreshEnabled: true,
    });

    initializeJsAppCheck(jsApp, {
      provider: new CustomProvider({
        getToken: async () => {
          const { token } = await getToken(nativeAppCheck, false);
          return {
            token,
            expireTimeMillis: resolveExpireTimeMillis(token),
          };
        },
      }),
      isTokenAutoRefreshEnabled: true,
    });

    const debugToken = resolveAppCheckDebugToken();
    console.log(
      resolveUseDebugProvider(debugToken)
        ? '✅ App Check initialized (debug provider, bridged to JS callables)'
        : '✅ App Check initialized (bridged to JS callables)',
    );

    const { token } = await getToken(nativeAppCheck, false);
    if (!token) {
      throw new Error('App Check returned an empty token');
    }
    console.log('✅ App Check token ready');
  })().catch((error: unknown) => {
    appCheckInitialized = false;
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      '🔥 App Check token fetch failed. For __DEV__: register a debug token in Firebase Console → App Check → StudyForge Capture (Android/iOS) → Manage debug tokens, then set NX_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN in .env.local (or register the UUID from `adb logcat | grep DebugAppCheckProvider`).',
      message,
    );
    throw error instanceof Error ? error : new Error(message);
  });
}

export async function waitForAppCheckReady(): Promise<void> {
  if (appCheckReadyPromise) {
    await appCheckReadyPromise;
  }
}
