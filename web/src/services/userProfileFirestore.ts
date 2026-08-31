import type { IUserProfile } from '@shared-types';
import { doc, getDoc, type DocumentData } from 'firebase/firestore';
import { db } from '../config/firebase';

function parseUserProfile(uid: string, raw: DocumentData): IUserProfile {
  return {
    uid,
    email: typeof raw.email === 'string' ? raw.email : undefined,
    displayName: typeof raw.displayName === 'string' ? raw.displayName : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    userGroupId: typeof raw.userGroupId === 'string' ? raw.userGroupId : undefined,
    emailVerificationExempt: raw.emailVerificationExempt === true,
  };
}

export async function fetchUserProfileFromFirestore(
  userId: string,
): Promise<IUserProfile | null> {
  const snapshot = await getDoc(doc(db, 'users', userId));
  if (!snapshot.exists()) {
    return null;
  }
  return parseUserProfile(snapshot.id, snapshot.data());
}
