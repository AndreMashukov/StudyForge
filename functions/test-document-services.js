import * as admin from 'firebase-admin';
import { DocumentService } from '../src/services/document-storage.js';
import { DocumentCrudService } from '../src/services/document-crud.js';

// Initialize Firebase Admin SDK for testing
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'demo-project', // Use emulator project ID
    storageBucket: 'demo-project.appspot.com',
  });
}

async function testDocumentStorage() {
  console.log('🧪 Testing Document Storage Service...\n');

  const testUserId = 'test-user-123';
  const testDocumentId = 'test-doc-456';
  const testContent = `# Test Document

This is a test markdown document for verifying the storage service.

## Features

- Firebase Storage integration
- Automatic markdown handling
- User isolation security

## Content

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor 
incididunt ut labore et dolore magna aliqua.

### Subsection

More content here to test the word count functionality.
`;

  const testMetadata = {
    title: 'Test Document',
    sourceType: 'upload' as const,
    wordCount: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    console.log('1️⃣ Testing document upload...');
    const storageFile = await DocumentService.uploadDocument(
      testUserId,
      testDocumentId,
      testContent,
      testMetadata
    );
    console.log('✅ Upload successful');
    console.log('   Path:', storageFile.path);
    console.log('   Size:', storageFile.metadata.size, 'bytes');
    console.log('   Download URL length:', storageFile.downloadUrl.length);

    console.log('\n2️⃣ Testing document retrieval...');
    const retrievedContent = await DocumentService.getDocumentContent(
      testUserId,
      testDocumentId
    );
    console.log('✅ Retrieval successful');
    console.log('   Content length:', retrievedContent.length);
    console.log('   Content matches:', retrievedContent === testContent);

    console.log('\n3️⃣ Testing metadata retrieval...');
    const metadata = await DocumentService.getDocumentMetadata(
      testUserId,
      testDocumentId
    );
    console.log('✅ Metadata retrieval successful');
    console.log('   Content type:', metadata.contentType);
    console.log('   Size:', metadata.size);
    console.log('   Created:', metadata.timeCreated);

    console.log('\n4️⃣ Testing download URL generation...');
    const downloadUrl = await DocumentService.getDownloadUrl(
      testUserId,
      testDocumentId,
      30 // 30 minutes
    );
    console.log('✅ Download URL generated');
    console.log('   URL length:', downloadUrl.length);
    console.log('   Contains signed URL params:', downloadUrl.includes('Expires='));

    console.log('\n5️⃣ Testing content validation...');
    try {
      DocumentService.validateDocumentContent('');
      console.log('❌ Empty content validation failed');
    } catch (error) {
      console.log('✅ Empty content properly rejected');
    }

    try {
      DocumentService.validateDocumentContent('Valid content');
      console.log('✅ Valid content accepted');
    } catch (error) {
      console.log('❌ Valid content validation failed:', error.message);
    }

    console.log('\n6️⃣ Testing document update...');
    const updatedContent = testContent + '\n\n## Updated Section\n\nThis content was added during update test.';
    const updatedStorageFile = await DocumentService.updateDocument(
      testUserId,
      testDocumentId,
      updatedContent,
      { wordCount: 65 }
    );
    console.log('✅ Update successful');
    console.log('   New size:', updatedStorageFile.metadata.size, 'bytes');

    console.log('\n7️⃣ Testing document cleanup...');
    await DocumentService.deleteDocument(testUserId, testDocumentId);
    console.log('✅ Cleanup successful');

    // Verify deletion
    try {
      await DocumentService.getDocumentContent(testUserId, testDocumentId);
      console.log('❌ Document still exists after deletion');
    } catch (error) {
      console.log('✅ Document properly deleted');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

async function testDocumentCrud() {
  console.log('\n\n🧪 Testing Document CRUD Service...\n');

  const testUserId = 'test-user-789';
  const testCreateRequest = {
    title: 'CRUD Test Document',
    description: 'Testing the comprehensive CRUD service',
    content: `# CRUD Test Document

This document tests the complete CRUD operations.

## Test Content

- Create ✓
- Read ✓  
- Update ✓
- Delete ✓

Lorem ipsum content for word count testing.
`,
    sourceType: 'upload' as const,
    tags: ['test', 'crud', 'markdown'],
  };

  try {
    console.log('1️⃣ Testing document creation...');
    const createdDoc = await DocumentCrudService.createDocument(testUserId, testCreateRequest);
    console.log('✅ Creation successful');
    console.log('   Document ID:', createdDoc.id);
    console.log('   Title:', createdDoc.title);
    console.log('   Word count:', createdDoc.wordCount);
    console.log('   Storage URL length:', createdDoc.storageUrl.length);

    const documentId = createdDoc.id;

    console.log('\n2️⃣ Testing document retrieval...');
    const retrievedDoc = await DocumentCrudService.getDocument(testUserId, documentId);
    console.log('✅ Retrieval successful');
    console.log('   Title matches:', retrievedDoc.title === createdDoc.title);
    console.log('   User ID matches:', retrievedDoc.userId === testUserId);

    console.log('\n3️⃣ Testing document with content retrieval...');
    const docWithContent = await DocumentCrudService.getDocumentWithContent(testUserId, documentId);
    console.log('✅ Content retrieval successful');
    console.log('   Has content:', !!docWithContent.content);
    console.log('   Content length:', docWithContent.content.length);
    console.log('   Content starts with title:', docWithContent.content.startsWith('# CRUD Test Document'));

    console.log('\n4️⃣ Testing document update...');
    const updateRequest = {
      title: 'Updated CRUD Test Document',
      description: 'Updated description for testing',
      tags: ['test', 'crud', 'markdown', 'updated'],
    };
    const updatedDoc = await DocumentCrudService.updateDocument(testUserId, documentId, updateRequest);
    console.log('✅ Update successful');
    console.log('   Title updated:', updatedDoc.title === updateRequest.title);
    console.log('   Description updated:', updatedDoc.description === updateRequest.description);
    console.log('   Tags updated:', updatedDoc.tags.includes('updated'));

    console.log('\n5️⃣ Testing document listing...');
    const listResult = await DocumentCrudService.listDocuments(testUserId, { limit: 10 });
    console.log('✅ Listing successful');
    console.log('   Documents found:', listResult.documents.length);
    console.log('   Total count:', listResult.total);
    console.log('   Has more:', listResult.hasMore);

    console.log('\n6️⃣ Testing document search...');
    const searchResults = await DocumentCrudService.searchDocuments(testUserId, 'CRUD');
    console.log('✅ Search successful');
    console.log('   Search results:', searchResults.length);
    console.log('   Found our document:', searchResults.some(doc => doc.id === documentId));

    console.log('\n7️⃣ Testing document stats...');
    const stats = await DocumentCrudService.getDocumentStats(testUserId);
    console.log('✅ Stats retrieval successful');
    console.log('   Total documents:', stats.total);
    console.log('   Upload documents:', stats.bySourceType.upload);
    console.log('   Active documents:', stats.byStatus.active);
    console.log('   Total word count:', stats.totalWordCount);

    console.log('\n8️⃣ Testing document deletion...');
    await DocumentCrudService.deleteDocument(testUserId, documentId);
    console.log('✅ Deletion successful');

    // Verify deletion
    try {
      await DocumentCrudService.getDocument(testUserId, documentId);
      console.log('❌ Document still exists after deletion');
    } catch (error) {
      console.log('✅ Document properly deleted from Firestore');
    }

  } catch (error) {
    console.error('❌ CRUD test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run tests
async function runAllTests() {
  console.log('🚀 Starting Document Service Tests\n');
  console.log('📝 Note: These tests require Firebase emulators to be running');
  console.log('   Run: firebase emulators:start --only storage,firestore\n');

  await testDocumentStorage();
  await testDocumentCrud();

  console.log('\n\n🎉 All tests completed!');
}

if (require.main === module) {
  runAllTests();
}

export { testDocumentStorage, testDocumentCrud, runAllTests };