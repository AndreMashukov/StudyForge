import * as admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });

const projectId = process.env.GCLOUD_PROJECT || 'code-insights-quiz-ai';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({ projectId });

async function getUserId() {
  try {
    const user = await admin.auth().getUserByEmail('test@example.com');
    console.log('User ID for test@example.com:', user.uid);
    return user.uid;
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getUserId().then(() => process.exit(0));
