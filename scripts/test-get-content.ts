import * as admin from 'firebase-admin';
import { DocumentCrudService } from './functions/src/services/document-crud';

async function testGetContent() {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199';
  
  admin.initializeApp({
    projectId: 'code-insights-quiz-ai',
    storageBucket: 'default-bucket'
  });

  const userId = 'HnHrrGtuJNjtk5zY80u8CHpe5Adk';
  const documentId = 'test-doc-for-flashcards';

  try {
    console.log('🔍 Testing getDocumentWithContent...');
    const doc = await DocumentCrudService.getDocumentWithContent(userId, documentId);
    console.log('✅ Success!');
    console.log('Title:', doc.title);
    console.log('Content length:', doc.content?.length || 0);
    console.log('Content preview:', doc.content?.substring(0, 100));
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testGetContent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
