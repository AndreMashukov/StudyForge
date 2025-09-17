import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Your web app's Firebase configuration
// For local development with emulators, we use demo project settings
const firebaseConfig = {
  apiKey: "demo-api-key-for-emulator",
  authDomain: "demo-code-insights-quiz-ai.firebaseapp.com",
  projectId: "demo-code-insights-quiz-ai",
  storageBucket: "demo-code-insights-quiz-ai.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:demo-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-east1');

// Connect to emulators in development
if (typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  
  // Auth emulator
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  } catch (error) {
    // Emulator already connected
    console.log('Auth emulator already connected or error:', error);
  }
  
  // Firestore emulator
  try {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  } catch (error) {
    // Emulator already connected
    console.log('Firestore emulator already connected or error:', error);
  }
  
  // Functions emulator
  try {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  } catch (error) {
    // Emulator already connected
    console.log('Functions emulator already connected or error:', error);
  }
}

export default app;