import { collection, doc } from 'firebase/firestore';
import { getClientDb } from './clientDb';

export function userRef(userId: string) {
  return doc(getClientDb(), 'users', userId);
}

export function userCollection(userId: string, name: string) {
  return collection(getClientDb(), 'users', userId, name);
}

export function documentRef(userId: string, documentId: string) {
  return doc(getClientDb(), 'users', userId, 'documents', documentId);
}

export function directoryRef(userId: string, directoryId: string) {
  return doc(getClientDb(), 'users', userId, 'directories', directoryId);
}

export function directoryItemRef(
  userId: string,
  directoryId: string,
  itemId: string,
) {
  return doc(
    getClientDb(),
    'users',
    userId,
    'directories',
    directoryId,
    'items',
    itemId,
  );
}

export function directoryItemsCollection(userId: string, directoryId: string) {
  return collection(
    getClientDb(),
    'users',
    userId,
    'directories',
    directoryId,
    'items',
  );
}

export function ruleRef(userId: string, ruleId: string) {
  return doc(getClientDb(), 'users', userId, 'rules', ruleId);
}

export function quizRef(userId: string, quizId: string) {
  return doc(getClientDb(), 'users', userId, 'quizzes', quizId);
}

export function flashcardSetRef(userId: string, flashcardSetId: string) {
  return doc(getClientDb(), 'users', userId, 'flashcardSets', flashcardSetId);
}

export function slideDeckRef(userId: string, slideDeckId: string) {
  return doc(getClientDb(), 'users', userId, 'slideDecks', slideDeckId);
}

export function diagramQuizRef(userId: string, diagramQuizId: string) {
  return doc(getClientDb(), 'users', userId, 'diagramQuizzes', diagramQuizId);
}

export function sequenceQuizRef(userId: string, sequenceQuizId: string) {
  return doc(getClientDb(), 'users', userId, 'sequenceQuizzes', sequenceQuizId);
}

export function matchQuizRef(userId: string, matchQuizId: string) {
  return doc(getClientDb(), 'users', userId, 'matchQuizzes', matchQuizId);
}

export function directoryChatThreadRef(userId: string, directoryId: string) {
  return doc(
    getClientDb(),
    'users',
    userId,
    'directories',
    directoryId,
    'chat',
    'thread',
  );
}

export function directoryChatMessagesCollection(
  userId: string,
  directoryId: string,
) {
  return collection(
    getClientDb(),
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
  return doc(getClientDb(), 'users', userId, 'agentThreads', threadId);
}

export function agentThreadMessagesCollection(
  userId: string,
  threadId: string,
) {
  return collection(
    getClientDb(),
    'users',
    userId,
    'agentThreads',
    threadId,
    'messages',
  );
}

export function billingRef(userId: string) {
  return doc(getClientDb(), 'users', userId, 'billing', 'state');
}

export function usageSummaryRef(userId: string) {
  return doc(getClientDb(), 'users', userId, 'usageSummary', 'current');
}

export function quizAttemptCollection(userId: string) {
  return collection(getClientDb(), 'users', userId, 'quizAttempts');
}

export function learningEventCollection(userId: string) {
  return collection(getClientDb(), 'users', userId, 'learningEvents');
}

export function quizStatRef(userId: string, statDocId: string) {
  return doc(getClientDb(), 'users', userId, 'quizStats', statDocId);
}

export function questionStatRef(userId: string, statDocId: string) {
  return doc(getClientDb(), 'users', userId, 'questionStats', statDocId);
}

export function knowledgeStatRef(userId: string, statDocId: string) {
  return doc(getClientDb(), 'users', userId, 'knowledgeStats', statDocId);
}

export function interactionSessionCollection(userId: string) {
  return collection(getClientDb(), 'users', userId, 'interactionSessions');
}

export function interactionStatRef(userId: string, statDocId: string) {
  return doc(getClientDb(), 'users', userId, 'interactionStats', statDocId);
}

export function interactionStatCollection(userId: string) {
  return collection(getClientDb(), 'users', userId, 'interactionStats');
}

export function learnedVocabularyCollection(userId: string) {
  return collection(getClientDb(), 'users', userId, 'learnedVocabulary');
}

export function flashcardStudySessionCollection(userId: string) {
  return collection(getClientDb(), 'users', userId, 'flashcardStudySessions');
}

export function statisticsHiddenFailureCollection(userId: string) {
  return collection(getClientDb(), 'users', userId, 'statisticsHiddenFailures');
}

export function statisticsHiddenFailureRef(userId: string, hiddenId: string) {
  return doc(
    getClientDb(),
    'users',
    userId,
    'statisticsHiddenFailures',
    hiddenId,
  );
}
