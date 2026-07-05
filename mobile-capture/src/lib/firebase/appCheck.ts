import { getApp } from '@react-native-firebase/app';
import {
  getToken,
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
} from '@react-native-firebase/app-check';
import { resolveAppCheckDebugToken, useFirebaseEmulator } from './config';

let appCheckReadyPromise: Promise<void> | undefined;

function resolveUseDebugProvider(): boolean {
  return __DEV__;
}

function buildAppCheckProvider(): ReactNativeFirebaseAppCheckProvider {
  const useDebugProvider = resolveUseDebugProvider();
  const debugToken = resolveAppCheckDebugToken();
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

export function initializeMobileAppCheck(): void {
  if (useFirebaseEmulator()) {
    return;
  }

  appCheckReadyPromise = (async () => {
    const appCheck = await initializeAppCheck(getApp(), {
      provider: buildAppCheckProvider(),
      isTokenAutoRefreshEnabled: true,
    });
    console.log(
      resolveUseDebugProvider()
        ? '✅ App Check initialized (debug provider)'
        : '✅ App Check initialized',
    );
    await getToken(appCheck, false);
    console.log('✅ App Check token ready');
  })().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      '🔥 App Check token fetch failed. Register debug tokens or Play Integrity/App Attest in Firebase Console → App Check:',
      message,
    );
  });
}

export async function waitForAppCheckReady(): Promise<void> {
  if (appCheckReadyPromise) {
    await appCheckReadyPromise;
  }
}
