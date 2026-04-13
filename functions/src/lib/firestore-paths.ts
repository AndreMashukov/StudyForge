import { getFirestore } from 'firebase-admin/firestore';

function db() {
  return getFirestore();
}

function validateUserId(userId: string): void {
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    throw new Error('FirestorePaths: userId must be a non-empty string');
  }
}

export const FirestorePaths = {
  documents: (userId: string) => {
    validateUserId(userId);
    return db().collection('users').doc(userId).collection('documents');
  },
  document: (userId: string, docId: string) =>
    FirestorePaths.documents(userId).doc(docId),

  quizzes: (userId: string) => {
    validateUserId(userId);
    return db().collection('users').doc(userId).collection('quizzes');
  },
  quiz: (userId: string, quizId: string) =>
    FirestorePaths.quizzes(userId).doc(quizId),

  directories: (userId: string) => {
    validateUserId(userId);
    return db().collection('users').doc(userId).collection('directories');
  },
  directory: (userId: string, dirId: string) =>
    FirestorePaths.directories(userId).doc(dirId),

  rules: (userId: string) => {
    validateUserId(userId);
    return db().collection('users').doc(userId).collection('rules');
  },
  rule: (userId: string, ruleId: string) =>
    FirestorePaths.rules(userId).doc(ruleId),

  flashcardSets: (userId: string) => {
    validateUserId(userId);
    return db().collection('users').doc(userId).collection('flashcardSets');
  },
  flashcardSet: (userId: string, setId: string) =>
    FirestorePaths.flashcardSets(userId).doc(setId),

  slideDecks: (userId: string) => {
    validateUserId(userId);
    return db().collection('users').doc(userId).collection('slideDecks');
  },
  slideDeck: (userId: string, deckId: string) =>
    FirestorePaths.slideDecks(userId).doc(deckId),

  diagramQuizzes: (userId: string) => {
    validateUserId(userId);
    return db().collection('users').doc(userId).collection('diagramQuizzes');
  },
  diagramQuiz: (userId: string, diagramQuizId: string) =>
    FirestorePaths.diagramQuizzes(userId).doc(diagramQuizId),

  sequenceQuizzes: (userId: string) => {
    validateUserId(userId);
    return db().collection('users').doc(userId).collection('sequenceQuizzes');
  },
  sequenceQuiz: (userId: string, sequenceQuizId: string) =>
    FirestorePaths.sequenceQuizzes(userId).doc(sequenceQuizId),

  interactionSessions: (userId: string) => {
    validateUserId(userId);
    return db().collection('users').doc(userId).collection('interactionSessions');
  },
  interactionSession: (userId: string, sessionId: string) =>
    FirestorePaths.interactionSessions(userId).doc(sessionId),

  interactionStats: (userId: string) => {
    validateUserId(userId);
    return db().collection('users').doc(userId).collection('interactionStats');
  },
  interactionStat: (userId: string, statId: string) =>
    FirestorePaths.interactionStats(userId).doc(statId),
};
