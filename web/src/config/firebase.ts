import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.NX_PUBLIC_FIREBASE_API_KEY || "demo-api-key-for-emulator",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || import.meta.env.NX_PUBLIC_FIREBASE_AUTH_DOMAIN || "study-forge-202604.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || import.meta.env.NX_PUBLIC_FIREBASE_PROJECT_ID || "study-forge-202604",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || import.meta.env.NX_PUBLIC_FIREBASE_STORAGE_BUCKET || "study-forge-202604.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || import.meta.env.NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "853327102927",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || import.meta.env.NX_PUBLIC_FIREBASE_APP_ID || "1:853327102927:web:4a3444a27948fac44088ba"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
export const functions = getFunctions(app, 'asia-east1');
export const storage = getStorage(app);

export const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' || 
                     import.meta.env.NX_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

function resolveAppCheckSiteKey(): string | undefined {
  const siteKey =
    import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY ||
    import.meta.env.NX_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;

  if (typeof siteKey !== 'string') {
    return undefined;
  }

  const trimmed = siteKey.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveAppCheckDebugToken(): boolean | string {
  const configured =
    import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN ||
    import.meta.env.NX_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;

  if (typeof configured === 'string' && configured.trim().length > 0) {
    return configured.trim();
  }

  return true;
}

function initializeWebAppCheck(options: { enableDebugToken: boolean }): void {
  if (typeof window === 'undefined') {
    return;
  }

  const siteKey = resolveAppCheckSiteKey();
  if (!siteKey) {
    const setupHint =
      'Set NX_PUBLIC_FIREBASE_APPCHECK_SITE_KEY to a reCAPTCHA v3 site key. Callable functions enforce App Check.';
    if (useEmulator) {
      console.warn(`⚠️ App Check: ${setupHint} Skipping App Check init in emulator.`);
    } else {
      console.error(`🔥 App Check: ${setupHint}`);
    }
    return;
  }

  if (options.enableDebugToken) {
    const debugToken = resolveAppCheckDebugToken();
    (globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      debugToken;
    if (typeof debugToken === 'string') {
      console.log(
        `ℹ️ App Check debug token (register in Firebase Console → App Check → Manage debug tokens): ${debugToken}`,
      );
    }
  }

  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    console.log(
      options.enableDebugToken
        ? '✅ App Check initialized (emulator debug token enabled)'
        : '✅ App Check initialized',
    );
  } catch (error) {
    console.error('🔥 Failed to initialize App Check:', error);
  }
}

if (typeof window !== 'undefined' && useEmulator) {
  console.log('🔧 Connecting to Firebase Emulators...');
  
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    console.log('✅ Auth Emulator connected');
  } catch (error) {
    console.log('⚠️ Auth emulator already connected or error:', error);
  }
  
  try {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    console.log('✅ Firestore Emulator connected');
  } catch (error) {
    console.log('⚠️ Firestore emulator already connected or error:', error);
  }
  
  try {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    console.log('✅ Functions Emulator connected');
  } catch (error) {
    console.log('⚠️ Functions emulator already connected or error:', error);
  }

  try {
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    console.log('✅ Storage Emulator connected');
  } catch (error) {
    console.log('⚠️ Storage emulator already connected or error:', error);
  }

  initializeWebAppCheck({ enableDebugToken: true });
} else if (typeof window !== 'undefined') {
  console.log('☁️ Using Production Firebase Services');
  initializeWebAppCheck({ enableDebugToken: false });
}

export default app;
