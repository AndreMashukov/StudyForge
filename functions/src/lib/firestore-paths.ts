import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

export const FirestorePaths = {
  documents: (userId: string) =>
    db.collection('users').doc(userId).collection('documents'),
  document: (userId: string, docId: string) =>
    FirestorePaths.documents(userId).doc(docId),

  quizzes: (userId: string) =>
    db.collection('users').doc(userId).collection('quizzes'),
  quiz: (userId: string, quizId: string) =>
    FirestorePaths.quizzes(userId).doc(quizId),

  directories: (userId: string) =>
    db.collection('users').doc(userId).collection('directories'),
  directory: (userId: string, dirId: string) =>
    FirestorePaths.directories(userId).doc(dirId),

  rules: (userId: string) =>
    db.collection('users').doc(userId).collection('rules'),
  rule: (userId: string, ruleId: string) =>
    FirestorePaths.rules(userId).doc(ruleId),
};
