import type { Rule } from '@shared-types';
import { fetchUserCollection, fetchUserDoc, orderByCreatedAtDesc } from './firestoreReadUtils';

const USER_RULES_LIMIT = 100;

export function fetchRuleFromFirestore(userId: string, ruleId: string): Promise<Rule | null> {
  return fetchUserDoc<Rule>(userId, 'rules', ruleId);
}

export function fetchRulesFromFirestore(userId: string): Promise<Rule[]> {
  return fetchUserCollection<Rule>(userId, 'rules', orderByCreatedAtDesc(USER_RULES_LIMIT));
}
