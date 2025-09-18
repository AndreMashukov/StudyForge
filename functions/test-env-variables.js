// Test script to verify environment variables are loaded correctly

// Load environment variables from workspace root
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('=== NX Workspace Environment Variables Test ===');
console.log('');

console.log('Firebase Configuration from Environment Variables:');
console.log('- Project ID:', process.env.NX_PUBLIC_FIREBASE_PROJECT_ID || 'NOT SET');
console.log('- Auth Domain:', process.env.NX_PUBLIC_FIREBASE_AUTH_DOMAIN || 'NOT SET');
console.log('- Storage Bucket:', process.env.NX_PUBLIC_FIREBASE_STORAGE_BUCKET || 'NOT SET');
console.log('- Messaging Sender ID:', process.env.NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'NOT SET');
console.log('- App ID:', process.env.NX_PUBLIC_FIREBASE_APP_ID || 'NOT SET');
console.log('- Region:', process.env.NX_FIREBASE_REGION || 'NOT SET');
console.log('');

console.log('Environment Mode:', process.env.NX_ENVIRONMENT || 'NOT SET');
console.log('');

// Test the Firebase config object construction
const firebaseConfig = {
  projectId: process.env.NX_PUBLIC_FIREBASE_PROJECT_ID || "demo-project-id",
  authDomain: process.env.NX_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
  storageBucket: process.env.NX_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-project.firebasestorage.app",
  messagingSenderId: process.env.NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NX_PUBLIC_FIREBASE_APP_ID || "demo-app-id"
};

console.log('Constructed Firebase Config:');
console.log(JSON.stringify(firebaseConfig, null, 2));
console.log('');

console.log('✅ Environment variables test completed successfully!');