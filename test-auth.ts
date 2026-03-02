import * as admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });

const projectId = process.env.GCLOUD_PROJECT || 'code-insights-quiz-ai';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({ projectId });

async function testAuth() {
  try {
    // Try to get the user
    const user = await admin.auth().getUserByEmail('test@example.com');
    console.log('✅ User exists:', user.uid);
    console.log('Email:', user.email);
    console.log('Email verified:', user.emailVerified);
    
    // Try to create a custom token
    const token = await admin.auth().createCustomToken(user.uid);
    console.log('\n✅ Custom token created successfully');
    console.log('Token (first 50 chars):', token.substring(0, 50) + '...');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAuth().then(() => process.exit(0));
