import * as admin from 'firebase-admin';

const userId = 'OtqRuAofWiLb4hDUyzmhW8MjcZ7H'; // The UID for test@example.com
const documentId = 'test-doc-for-flashcards';

const documentContent = `
# An Introduction to Neural Networks

A neural network is a method in artificial intelligence that teaches computers to process data in a way that is inspired by the human brain. It is a type of machine learning process, called deep learning, that uses interconnected nodes or neurons in a layered structure that resembles the human brain.

## Core Components
A neural network has three main components:
1. **Input Layer:** Receives the initial data.
2. **Hidden Layers:** One or more layers that perform computations on the data. The "deep" in deep learning refers to having many hidden layers.
3. **Output Layer:** Produces the final result, such as a classification or a prediction.

## How They Learn
Neural networks learn by adjusting the "weights" of the connections between neurons. This process is called training. During training, the network is fed large amounts of labeled data, and it adjusts its weights to minimize the difference between its output and the correct answer. This process is often managed by an optimization algorithm called gradient descent.
`;

async function createTestData() {
  // Set up Firebase Admin SDK for emulators
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199';
  
  admin.initializeApp({
    projectId: 'code-insights-quiz-ai',
    storageBucket: 'code-insights-quiz-ai.appspot.com',
  });

  const db = admin.firestore();

  // 1. Create the user's document metadata in Firestore
  const docRef = db.collection('users').doc(userId).collection('documents').doc(documentId);
  await docRef.set({
    title: 'Intro to Neural Networks',
    description: 'A test document for generating flashcards.',
    userId: userId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    wordCount: documentContent.split(/\s+/).length,
    sourceType: 'generated',
    status: 'active',
    storagePath: `documents/${userId}/${documentId}.md`, // Path for the content in Storage
  });

  // 2. "Upload" the document content to Firebase Storage emulator
  const bucket = admin.storage().bucket();
  const file = bucket.file(`users/${userId}/documents/${documentId}/content.md`);
  await file.save(documentContent);

  console.log(`✅ Test document '${documentId}' created for user '${userId}'.`);
}

createTestData().catch(console.error);
