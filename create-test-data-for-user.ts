import * as admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });

const projectId = process.env.GCLOUD_PROJECT || 'code-insights-quiz-ai';
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

admin.initializeApp({ projectId });

const db = admin.firestore();

async function createTestDataForUser() {
  const userId = '4ZBsEPIUJ4jrlylcXkg7t3sFdPZv'; // test@example.com
  
  console.log('📝 Creating test data for user:', userId);
  
  // Create test documents
  const documents = [
    {
      id: 'doc1',
      userId: userId,
      title: 'Introduction to Machine Learning',
      description: 'A comprehensive guide to ML basics',
      sourceType: 'generated',
      wordCount: 2500,
      status: 'active',
      storageUrl: 'https://example.com/doc1.md',
      storagePath: 'users/test/doc1.md',
      tags: ['machine-learning', 'AI', 'tutorial'],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      id: 'doc2',
      userId: userId,
      title: 'React Best Practices 2024',
      description: 'Modern React development patterns',
      sourceType: 'url',
      sourceUrl: 'https://react.dev/learn',
      wordCount: 1800,
      status: 'active',
      storageUrl: 'https://example.com/doc2.md',
      storagePath: 'users/test/doc2.md',
      tags: ['react', 'javascript', 'frontend'],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      id: 'doc3',
      userId: userId,
      title: 'TypeScript Advanced Types',
      description: 'Deep dive into TypeScript type system',
      sourceType: 'upload',
      wordCount: 3200,
      status: 'active',
      storageUrl: 'https://example.com/doc3.md',
      storagePath: 'users/test/doc3.md',
      tags: ['typescript', 'programming', 'types'],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }
  ];
  
  // Add documents to Firestore
  for (const doc of documents) {
    await db.collection('users').doc(userId).collection('documents').doc(doc.id).set(doc);
    console.log('✅ Created document:', doc.title);
  }
  
  // Create test directories
  const directories = [
    {
      id: 'dir1',
      userId: userId,
      name: 'Machine Learning',
      parentId: null,
      path: '/Machine Learning',
      level: 0,
      color: 'blue',
      icon: 'folder',
      documentCount: 1,
      childCount: 0,
      ruleIds: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      id: 'dir2',
      userId: userId,
      name: 'Web Development',
      parentId: null,
      path: '/Web Development',
      level: 0,
      color: 'green',
      icon: 'folder',
      documentCount: 2,
      childCount: 0,
      ruleIds: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }
  ];
  
  for (const dir of directories) {
    await db.collection('users').doc(userId).collection('directories').doc(dir.id).set(dir);
    console.log('✅ Created directory:', dir.name);
  }
  
  // Create test quiz
  const quiz = {
    id: 'quiz1',
    userId: userId,
    documentId: 'doc1',
    title: 'Machine Learning Basics Quiz',
    questions: [
      {
        question: 'What is supervised learning?',
        options: [
          'Learning with labeled data',
          'Learning without labels',
          'Learning through rewards',
          'Learning through exploration'
        ],
        correctAnswer: 0,
        explanation: 'Supervised learning uses labeled datasets to train algorithms.'
      }
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    documentTitle: 'Introduction to Machine Learning',
  };
  
  await db.collection('users').doc(userId).collection('quizzes').doc(quiz.id).set(quiz);
  console.log('✅ Created quiz:', quiz.title);
  
  // Create a test rule
  const rule = {
    id: 'rule1',
    userId: userId,
    name: 'General Document Guidelines',
    description: 'Standard rules for document generation',
    content: 'Generate clear, well-structured documents with examples.',
    color: 'blue',
    tags: ['general', 'document'],
    applicableTo: ['prompt', 'upload'],
    isDefault: true,
    directoryIds: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  
  await db.collection('users').doc(userId).collection('rules').doc(rule.id).set(rule);
  console.log('✅ Created rule:', rule.name);
  
  console.log('\n✨ Test data creation completed for user:', userId);
}

createTestDataForUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
