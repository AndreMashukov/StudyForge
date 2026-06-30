import type { Rule } from '@shared-types';
import { fetchUserCollection, fetchUserDoc, orderByCreatedAtDesc } from './firestoreReadUtils';

export function fetchRuleFromFirestore(userId: string, ruleId: string): Promise<Rule | null> {
  return fetchUserDoc<Rule>(userId, 'rules', ruleId);
}

export function fetchRulesFromFirestore(userId: string): Promise<Rule[]> {
  return fetchUserCollection<Rule>(userId, 'rules', orderByCreatedAtDesc());
}
