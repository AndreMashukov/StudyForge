import { doc, getDoc } from 'firebase/firestore';
import type { SubjectWorld, SubjectWorldProgressSnapshot } from '@shared-types';
import { db } from '../config/firebase';
import { fetchUserCollection, fetchUserDoc, orderByCreatedAtDesc } from './firestoreReadUtils';

const USER_SUBJECT_WORLDS_LIMIT = 50;

export function fetchSubjectWorldFromFirestore(
  userId: string,
  subjectWorldId: string,
): Promise<SubjectWorld | null> {
  return fetchUserDoc<SubjectWorld>(userId, 'subjectWorlds', subjectWorldId);
}

export function fetchUserSubjectWorldsFromFirestore(userId: string): Promise<SubjectWorld[]> {
  return fetchUserCollection<SubjectWorld>(
    userId,
    'subjectWorlds',
    orderByCreatedAtDesc(USER_SUBJECT_WORLDS_LIMIT),
  );
}

export async function fetchSubjectWorldProgressFromFirestore(
  userId: string,
  subjectWorldId: string,
): Promise<SubjectWorldProgressSnapshot | null> {
  const snapshot = await getDoc(
    doc(db, 'users', userId, 'subjectWorlds', subjectWorldId, 'progress', userId),
  );
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  if (!data || typeof data !== 'object' || !('progress' in data)) {
    return null;
  }

  const progress = data.progress;
  if (!progress || typeof progress !== 'object') {
    return null;
  }

  return progress as SubjectWorldProgressSnapshot;
}
