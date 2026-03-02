import * as admin from 'firebase-admin';

async function fixDocument() {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  admin.initializeApp({ projectId: 'code-insights-quiz-ai' });

  const db = admin.firestore();

  // Update the document to add directoryId
  await db.collection('users').doc('HnHrrGtuJNjtk5zY80u8CHpe5Adk').collection('documents').doc('test-doc-for-flashcards').update({
    directoryId: null // null means root directory
  });

  console.log('✅ Document updated with directoryId: null');
}

fixDocument()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
