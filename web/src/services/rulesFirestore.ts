import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { Rule } from '@shared-types';
import { db } from '../config/firebase';
import {
  fetchUserCollection,
  fetchUserDoc,
  orderByCreatedAtDesc,
} from './firestoreReadUtils';

const USER_RULES_LIMIT = 100;

export function fetchRuleFromFirestore(
  userId: string,
  ruleId: string,
): Promise<Rule | null> {
  return fetchUserDoc<Rule>(userId, 'rules', ruleId);
}

export function fetchRulesFromFirestore(userId: string): Promise<Rule[]> {
  return fetchUserCollection<Rule>(
    userId,
    'rules',
    orderByCreatedAtDesc(USER_RULES_LIMIT),
  );
}

/**
 * Aggregates unique tags across all user rules.
 * Paginates in USER_RULES_LIMIT pages to satisfy Firestore security
 * `isBoundedList(100)` while remaining complete (unlike the capped list endpoint).
 */
export async function fetchRuleTagsFromFirestore(
  userId: string,
): Promise<string[]> {
  const tags = new Set<string>();
  const collectionRef = collection(db, 'users', userId, 'rules');
  let lastDoc: QueryDocumentSnapshot<DocumentData> | undefined;

  for (;;) {
    const pageQuery = lastDoc
      ? query(
          collectionRef,
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(USER_RULES_LIMIT),
        )
      : query(
          collectionRef,
          orderBy('createdAt', 'desc'),
          limit(USER_RULES_LIMIT),
        );

    const snapshot = await getDocs(pageQuery);
    if (snapshot.empty) {
      break;
    }

    for (const document of snapshot.docs) {
      const ruleTags = document.data().tags;
      if (!Array.isArray(ruleTags)) {
        continue;
      }
      for (const tag of ruleTags) {
        if (typeof tag === 'string') {
          tags.add(tag);
        }
      }
    }

    if (snapshot.docs.length < USER_RULES_LIMIT) {
      break;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  return Array.from(tags).sort();
}
