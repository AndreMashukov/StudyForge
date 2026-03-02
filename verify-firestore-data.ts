import * as admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });

const projectId = process.env.GCLOUD_PROJECT || 'code-insights-quiz-ai';
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

admin.initializeApp({ projectId });

const db = admin.firestore();

async function verifyData() {
  const userId = '4ZBsEPIUJ4jrlylcXkg7t3sFdPZv';
  
  console.log('🔍 Verifying data for user:', userId);
  
  // Check documents
  const docsSnapshot = await db.collection('users').doc(userId).collection('documents').get();
  console.log('\n📄 Documents:', docsSnapshot.size);
  docsSnapshot.forEach(doc => {
    console.log('  -', doc.data().title);
  });
  
  // Check quizzes
  const quizzesSnapshot = await db.collection('users').doc(userId).collection('quizzes').get();
  console.log('\n📝 Quizzes:', quizzesSnapshot.size);
  quizzesSnapshot.forEach(doc => {
    console.log('  -', doc.data().title);
  });
  
  // Check rules
  const rulesSnapshot = await db.collection('users').doc(userId).collection('rules').get();
  console.log('\n📋 Rules:', rulesSnapshot.size);
  rulesSnapshot.forEach(doc => {
    console.log('  -', doc.data().name);
  });
  
  // Check directories
  const dirsSnapshot = await db.collection('users').doc(userId).collection('directories').get();
  console.log('\n📁 Directories:', dirsSnapshot.size);
  dirsSnapshot.forEach(doc => {
    console.log('  -', doc.data().name);
  });
}

verifyData()
  .then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
