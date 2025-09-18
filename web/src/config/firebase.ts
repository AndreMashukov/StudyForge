import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Your web app's Firebase configuration
// Uses NX_PUBLIC_ environment variables (preferred) with VITE_ fallbacks for local development
const firebaseConfig = {
  apiKey: import.meta.env.NX_PUBLIC_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key-for-emulator",
  authDomain: import.meta.env.NX_PUBLIC_FIREBASE_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-code-insights-quiz-ai.firebaseapp.com",
  projectId: import.meta.env.NX_PUBLIC_FIREBASE_PROJECT_ID || import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-code-insights-quiz-ai",
  storageBucket: import.meta.env.NX_PUBLIC_FIREBASE_STORAGE_BUCKET || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-code-insights-quiz-ai.appspot.com",
  messagingSenderId: import.meta.env.NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.NX_PUBLIC_FIREBASE_APP_ID || import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:demo-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-east1');

// Connect to emulators based on environment variable
// Set NX_PUBLIC_USE_FIREBASE_EMULATOR=true or VITE_USE_FIREBASE_EMULATOR=true in your .env files to use emulators
// Set to false or omit to use production Firebase
const useEmulator = import.meta.env.NX_PUBLIC_USE_FIREBASE_EMULATOR === 'true' || import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

if (typeof window !== 'undefined' && useEmulator) {
  console.log('🔧 Connecting to Firebase Emulators...');
  
  // Auth emulator
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    console.log('✅ Auth Emulator connected');
  } catch (error) {
    console.log('⚠️ Auth emulator already connected or error:', error);
  }
  
  // Firestore emulator
  try {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    console.log('✅ Firestore Emulator connected');
  } catch (error) {
    console.log('⚠️ Firestore emulator already connected or error:', error);
  }
  
  // Functions emulator
  try {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    console.log('✅ Functions Emulator connected');
  } catch (error) {
    console.log('⚠️ Functions emulator already connected or error:', error);
  }
} else {
  console.log('☁️ Using Production Firebase Services');
}

export default app;