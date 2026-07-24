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

  generationJobs: (userId: string) => {
    validateUserId(userId);
    return db().collection('users').doc(userId).collection('generationJobs');
  },
  generationJob: (userId: string, jobId: string) =>
    FirestorePaths.generationJobs(userId).doc(jobId),

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

  directoryItems: (userId: string, dirId: string) =>
    FirestorePaths.directory(userId, dirId).collection('items'),

  directoryItem: (userId: string, dirId: string, itemId: string) =>
    FirestorePaths.directoryItems(userId, dirId).doc(itemId),

  directoryChatThread: (userId: string, dirId: string) =>
    FirestorePaths.directory(userId, dirId).collection('chat').doc('thread'),
  directoryChatMessages: (userId: string, dirId: string) =>
    FirestorePaths.directoryChatThread(userId, dirId).collection('messages'),

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

  learnedVocabulary: (userId: string) => {
    validateUserId(userId);
    return db().collection('users').doc(userId).collection('learnedVocabulary');
  },
  learnedVocabularyItem: (userId: string, itemId: string) =>
    FirestorePaths.learnedVocabulary(userId).doc(itemId),

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

  subjectWorlds: (userId: string) => {
    validateUserId(userId);
    return db().collection('users').doc(userId).collection('subjectWorlds');
  },
  subjectWorld: (userId: string, subjectWorldId: string) =>
    FirestorePaths.subjectWorlds(userId).doc(subjectWorldId),
  subjectWorldProgress: (userId: string, subjectWorldId: string) =>
    FirestorePaths.subjectWorld(userId, subjectWorldId).collection('progress'),

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

  learningEvents: (userId: string) => {
    validateUserId(userId);
    return db().collection('users').doc(userId).collection('learningEvents');
  },
  learningEvent: (userId: string, eventId: string) =>
    FirestorePaths.learningEvents(userId).doc(eventId),

  quizAttempts: (userId: string) => {
    validateUserId(userId);
    return db().collection('users').doc(userId).collection('quizAttempts');
  },
  quizAttempt: (userId: string, attemptId: string) =>
    FirestorePaths.quizAttempts(userId).doc(attemptId),

  quizStats: (userId: string) => {
    validateUserId(userId);
    return db().collection('users').doc(userId).collection('quizStats');
  },
  quizStat: (userId: string, statId: string) =>
    FirestorePaths.quizStats(userId).doc(statId),

  questionStats: (userId: string) => {
    validateUserId(userId);
    return db().collection('users').doc(userId).collection('questionStats');
  },
  questionStat: (userId: string, statId: string) =>
    FirestorePaths.questionStats(userId).doc(statId),

  knowledgeStats: (userId: string) => {
    validateUserId(userId);
    return db().collection('users').doc(userId).collection('knowledgeStats');
  },
  knowledgeStat: (userId: string, statId: string) =>
    FirestorePaths.knowledgeStats(userId).doc(statId),
};
