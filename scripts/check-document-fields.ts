import * as admin from 'firebase-admin';

async function checkDocument() {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  admin.initializeApp({ projectId: 'code-insights-quiz-ai' });

  const db = admin.firestore();

  // Get the document
  const doc = await db.collection('users').doc('HnHrrGtuJNjtk5zY80u8CHpe5Adk').collection('documents').doc('test-doc-for-flashcards').get();
  
  if (doc.exists) {
    console.log('Document data:');
    console.log(JSON.stringify(doc.data(), null, 2));
    
    // Check if directoryId exists
    const data = doc.data();
    if (!data?.directoryId) {
      console.log('\n⚠️ WARNING: directoryId field is missing!');
    } else {
      console.log('\n✅ directoryId:', data.directoryId);
    }
  } else {
    console.log('Document not found');
  }
}

checkDocument()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
