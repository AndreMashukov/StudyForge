import * as admin from 'firebase-admin';

async function checkStorage() {
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199';
  admin.initializeApp({
    projectId: 'code-insights-quiz-ai',
    storageBucket: 'code-insights-quiz-ai.appspot.com'
  });

  const bucket = admin.storage().bucket();
  
  // List all files in the bucket
  const [files] = await bucket.getFiles();
  
  console.log('📁 Files in Storage:');
  files.forEach(file => {
    console.log('  -', file.name);
  });
  
  // Check specific file
  const userId = '7uuAuNqh1MWjmH6QJ4E1qhPNvUb5';
  const documentId = 'test-doc-for-flashcards';
  const expectedPath = `users/${userId}/documents/${documentId}/content.md`;
  
  const file = bucket.file(expectedPath);
  const [exists] = await file.exists();
  
  console.log(`\n🔍 Checking for file at: ${expectedPath}`);
  console.log(exists ? '✅ File exists!' : '❌ File NOT found');
  
  if (exists) {
    const [content] = await file.download();
    console.log('\n📄 File content preview:');
    console.log(content.toString().substring(0, 200) + '...');
  }
}

checkStorage()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
