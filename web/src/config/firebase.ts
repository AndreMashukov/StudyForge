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

  try {
    (globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY || import.meta.env.NX_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
    if (!appCheckSiteKey) {
      console.warn('⚠️ App Check: Set VITE_FIREBASE_APPCHECK_SITE_KEY or NX_PUBLIC_FIREBASE_APPCHECK_SITE_KEY in .env. Create a reCAPTCHA v3 key in the reCAPTCHA Admin Console for your dev domain. Skipping App Check init.');
    } else {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
      console.log('✅ App Check Emulator connected');
    }
  } catch (error) {
    console.error('🔥 Error connecting to App Check Emulator:', error);
  }
} else {
  console.log('☁️ Using Production Firebase Services');
}

export default app;
