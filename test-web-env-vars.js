// Test script to verify NX environment variables work in a Vite context
// This simulates how variables would be available in the web application

// Load environment variables from workspace root
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('=== Web App Environment Variables Test ===');
console.log('');

// Simulate import.meta.env for testing (in actual Vite app, these would be automatically available)
const mockImportMetaEnv = {
  // These would be loaded automatically by Vite from .env files
  NX_PUBLIC_FIREBASE_PROJECT_ID: process.env.NX_PUBLIC_FIREBASE_PROJECT_ID,
  NX_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NX_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NX_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NX_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NX_PUBLIC_FIREBASE_APP_ID: process.env.NX_PUBLIC_FIREBASE_APP_ID,
  NX_PUBLIC_FIREBASE_API_KEY: process.env.NX_PUBLIC_FIREBASE_API_KEY,
  NX_PUBLIC_USE_FIREBASE_EMULATOR: process.env.NX_PUBLIC_USE_FIREBASE_EMULATOR,
};

console.log('NX_PUBLIC_ Environment Variables (available in web app):');
Object.entries(mockImportMetaEnv).forEach(([key, value]) => {
  console.log(`- ${key}:`, value || 'NOT SET');
});
console.log('');

// Test the Firebase config construction (as it would work in the web app)
const firebaseConfig = {
  apiKey: mockImportMetaEnv.NX_PUBLIC_FIREBASE_API_KEY || "demo-api-key-for-emulator",
  authDomain: mockImportMetaEnv.NX_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-code-insights-quiz-ai.firebaseapp.com",
  projectId: mockImportMetaEnv.NX_PUBLIC_FIREBASE_PROJECT_ID || "demo-code-insights-quiz-ai",
  storageBucket: mockImportMetaEnv.NX_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-code-insights-quiz-ai.appspot.com",
  messagingSenderId: mockImportMetaEnv.NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: mockImportMetaEnv.NX_PUBLIC_FIREBASE_APP_ID || "1:123456789012:web:demo-app-id"
};

console.log('Constructed Firebase Config (as would be used in web app):');
console.log(JSON.stringify(firebaseConfig, null, 2));
console.log('');

console.log('Use Firebase Emulator:', mockImportMetaEnv.NX_PUBLIC_USE_FIREBASE_EMULATOR === 'true' ? 'YES' : 'NO');
console.log('');

console.log('✅ Web app environment variables test completed successfully!');
console.log('');
console.log('📝 Note: In the actual Vite web app, these variables are automatically');
console.log('   available via import.meta.env without needing dotenv configuration.');