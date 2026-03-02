import * as admin from 'firebase-admin';

const userId = 'HnHrrGtuJNjtk5zY80u8CHpe5Adk';

async function checkData() {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  admin.initializeApp({ projectId: 'code-insights-quiz-ai' });

  const db = admin.firestore();

  // Check documents
  const docsSnapshot = await db.collection('users').doc(userId).collection('documents').get();
  console.log('\n📄 Documents:', docsSnapshot.size);
  docsSnapshot.forEach(doc => {
    const data = doc.data();
    console.log('  -', data.title, '| id:', doc.id);
  });
}

checkData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
