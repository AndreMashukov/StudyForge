import { collection, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

export function userRef(userId: string) {
  return doc(db, 'users', userId);
}

export function userCollection(userId: string, name: string) {
  return collection(db, 'users', userId, name);
}

export function documentRef(userId: string, documentId: string) {
  return doc(db, 'users', userId, 'documents', documentId);
}

export function directoryRef(userId: string, directoryId: string) {
  return doc(db, 'users', userId, 'directories', directoryId);
}

export function directoryItemRef(
  userId: string,
  directoryId: string,
  itemId: string,
) {
  return doc(db, 'users', userId, 'directories', directoryId, 'items', itemId);
}

export function directoryItemsCollection(userId: string, directoryId: string) {
  return collection(db, 'users', userId, 'directories', directoryId, 'items');
}

export function ruleRef(userId: string, ruleId: string) {
  return doc(db, 'users', userId, 'rules', ruleId);
}

export function quizRef(userId: string, quizId: string) {
  return doc(db, 'users', userId, 'quizzes', quizId);
}

export function flashcardSetRef(userId: string, flashcardSetId: string) {
  return doc(db, 'users', userId, 'flashcardSets', flashcardSetId);
}

export function slideDeckRef(userId: string, slideDeckId: string) {
  return doc(db, 'users', userId, 'slideDecks', slideDeckId);
}

export function diagramQuizRef(userId: string, diagramQuizId: string) {
  return doc(db, 'users', userId, 'diagramQuizzes', diagramQuizId);
}

export function sequenceQuizRef(userId: string, sequenceQuizId: string) {
  return doc(db, 'users', userId, 'sequenceQuizzes', sequenceQuizId);
}

export function directoryChatThreadRef(userId: string, directoryId: string) {
  return doc(db, 'users', userId, 'directories', directoryId, 'chat', 'thread');
}

export function directoryChatMessagesCollection(
  userId: string,
  directoryId: string,
) {
  return collection(
    db,
    'users',
    userId,
    'directories',
    directoryId,
    'chat',
    'thread',
    'messages',
  );
}

export function agentThreadRef(userId: string, threadId: string) {
  return doc(db, 'users', userId, 'agentThreads', threadId);
}

export function agentThreadMessagesCollection(userId: string, threadId: string) {
  return collection(db, 'users', userId, 'agentThreads', threadId, 'messages');
}

export function billingRef(userId: string) {
  return doc(db, 'users', userId, 'billing', 'state');
}

export function usageSummaryRef(userId: string) {
  return doc(db, 'users', userId, 'usageSummary', 'current');
}

export function quizAttemptCollection(userId: string) {
  return collection(db, 'users', userId, 'quizAttempts');
}

export function learningEventCollection(userId: string) {
  return collection(db, 'users', userId, 'learningEvents');
}

export function quizStatRef(userId: string, statDocId: string) {
  return doc(db, 'users', userId, 'quizStats', statDocId);
}

export function questionStatRef(userId: string, statDocId: string) {
  return doc(db, 'users', userId, 'questionStats', statDocId);
}

export function knowledgeStatRef(userId: string, statDocId: string) {
  return doc(db, 'users', userId, 'knowledgeStats', statDocId);
}

export function interactionSessionCollection(userId: string) {
  return collection(db, 'users', userId, 'interactionSessions');
}

export function interactionStatRef(userId: string, statDocId: string) {
  return doc(db, 'users', userId, 'interactionStats', statDocId);
}

export function interactionStatCollection(userId: string) {
  return collection(db, 'users', userId, 'interactionStats');
}

export function learnedVocabularyCollection(userId: string) {
  return collection(db, 'users', userId, 'learnedVocabulary');
}
