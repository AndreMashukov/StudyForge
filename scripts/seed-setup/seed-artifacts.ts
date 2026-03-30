import * as admin from 'firebase-admin';

// Initialize admin SDK for emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199';

admin.initializeApp({ projectId: 'code-insights-quiz-ai' });
const db = admin.firestore();

const USER_ID = '4ZBsEPIUJ4jrlylcXkg7t3sFdPZv';
const DIR_ID = 'e2e-study-materials';
const DOC_ID = 'perfect-doc-ml';

async function seed() {
  // 1. Seed 2 quizzes
  console.log('Seeding quizzes...');
  for (let i = 1; i <= 2; i++) {
    const quizId = `test-quiz-${i}`;
    await db.doc(`users/${USER_ID}/quizzes/${quizId}`).set({
      id: quizId,
      documentId: DOC_ID,
      title: i === 1 ? 'Machine Learning Basics - Quiz' : 'System Design Patterns - Quiz',
      questions: [
        {
          question: 'What is machine learning?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 0,
          explanation: 'Test explanation'
        }
      ],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      userId: USER_ID,
      directoryId: DIR_ID,
      generationAttempt: 1,
      documentTitle: i === 1 ? 'Machine Learning' : 'System Design Fundamentals'
    });
    console.log(`  ✅ Quiz ${quizId} created`);
  }

  // 2. Seed 1 flashcard set
  console.log('Seeding flashcard set...');
  const fcId = 'test-flashcard-1';
  await db.doc(`users/${USER_ID}/flashcardSets/${fcId}`).set({
    id: fcId,
    documentId: DOC_ID,
    title: 'Machine Learning - Flashcards',
    cards: [
      { front: 'What is ML?', back: 'Machine Learning is...' },
      { front: 'What is DL?', back: 'Deep Learning is...' }
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    userId: USER_ID,
    directoryId: DIR_ID,
    documentTitle: 'Machine Learning'
  });
  console.log(`  ✅ Flashcard set ${fcId} created`);

  // 3. Seed 1 slide deck
  console.log('Seeding slide deck...');
  const sdId = 'test-slidedeck-1';
  await db.doc(`users/${USER_ID}/slideDecks/${sdId}`).set({
    id: sdId,
    documentId: DOC_ID,
    title: 'Machine Learning - Slides',
    slides: [
      { title: 'Introduction', content: 'ML overview', order: 1 },
      { title: 'Types of ML', content: 'Supervised, Unsupervised', order: 2 }
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    userId: USER_ID,
    directoryId: DIR_ID,
    documentTitle: 'Machine Learning'
  });
  console.log(`  ✅ Slide deck ${sdId} created`);

  console.log('\n✅ All artifacts seeded!');
}

seed().catch(e => { console.error('FAIL:', e); process.exit(1); });
