import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { 
  Rule, 
  CreateRuleRequest, 
  UpdateRuleRequest,
  RuleApplicability,
  RuleColor 
} from '@shared-types';

const db = getFirestore();

/**
 * Rule CRUD Service
 * Handles all database operations for rules
 */

/**
 * Create a new rule
 */
export async function createRule(
  userId: string,
  request: CreateRuleRequest
): Promise<Rule> {
  // Validate content length
  if (request.content.length > 15000) {
    throw new Error('Rule content cannot exceed 15,000 characters');
  }

  // Validate at least one applicability selected
  if (!request.applicableTo || request.applicableTo.length === 0) {
    throw new Error('Rule must be applicable to at least one operation type');
  }

  const ruleRef = db.collection('users').doc(userId).collection('rules').doc();
  
  const now = FieldValue.serverTimestamp();
  
  const ruleData = {
    id: ruleRef.id,
    userId,
    name: request.name,
    description: request.description || '',
    content: request.content,
    color: request.color,
    tags: request.tags || [],
    applicableTo: request.applicableTo,
    isDefault: request.isDefault || false,
    directoryIds: [], // Empty initially, attached separately
    createdAt: now,
    updatedAt: now,
  };

  await ruleRef.set(ruleData);

  // Return the rule with Date objects instead of FieldValue
  return {
    ...ruleData,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Rule;
}

/**
 * Get a single rule by ID
 */
export async function getRule(userId: string, ruleId: string): Promise<Rule | null> {
  const ruleDoc = await db
    .collection('users')
    .doc(userId)
    .collection('rules')
    .doc(ruleId)
    .get();

  if (!ruleDoc.exists) {
    return null;
  }

  const data = ruleDoc.data();
  return {
    ...data,
    createdAt: data?.createdAt?.toDate() || new Date(),
    updatedAt: data?.updatedAt?.toDate() || new Date(),
  } as Rule;
}

/**
 * Get all rules for a user
 */
export async function getRules(userId: string): Promise<Rule[]> {
  const rulesSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('rules')
    .orderBy('createdAt', 'desc')
    .get();

  return rulesSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Rule;
  });
}

/**
 * Get rules by IDs
 */
export async function getRulesByIds(
  userId: string, 
  ruleIds: string[]
): Promise<Rule[]> {
  if (ruleIds.length === 0) {
    return [];
  }

  // Firestore 'in' queries are limited to 10 items
  // If we have more, we need to batch the queries
  const chunks: string[][] = [];
  for (let i = 0; i < ruleIds.length; i += 10) {
    chunks.push(ruleIds.slice(i, i + 10));
  }

  const rules: Rule[] = [];

  for (const chunk of chunks) {
    const snapshot = await db
      .collection('users')
      .doc(userId)
      .collection('rules')
      .where('id', 'in', chunk)
      .get();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      rules.push({
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Rule);
    });
  }

  return rules;
}

/**
 * Update a rule
 */
export async function updateRule(
  userId: string,
  request: UpdateRuleRequest
): Promise<Rule> {
  const ruleRef = db
    .collection('users')
    .doc(userId)
    .collection('rules')
    .doc(request.ruleId);

  const ruleDoc = await ruleRef.get();
  
  if (!ruleDoc.exists) {
    throw new Error('Rule not found');
  }

  // Validate content length if content is being updated
  if (request.content && request.content.length > 15000) {
    throw new Error('Rule content cannot exceed 15,000 characters');
  }

  // Validate at least one applicability if updating applicableTo
  if (request.applicableTo && request.applicableTo.length === 0) {
    throw new Error('Rule must be applicable to at least one operation type');
  }

  const updateData: any = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Only update fields that are provided
  if (request.name !== undefined) updateData.name = request.name;
  if (request.description !== undefined) updateData.description = request.description;
  if (request.content !== undefined) updateData.content = request.content;
  if (request.color !== undefined) updateData.color = request.color;
  if (request.tags !== undefined) updateData.tags = request.tags;
  if (request.applicableTo !== undefined) updateData.applicableTo = request.applicableTo;
  if (request.isDefault !== undefined) updateData.isDefault = request.isDefault;

  await ruleRef.update(updateData);

  // Get and return updated rule
  const updatedDoc = await ruleRef.get();
  const data = updatedDoc.data();
  
  return {
    ...data,
    createdAt: data?.createdAt?.toDate() || new Date(),
    updatedAt: data?.updatedAt?.toDate() || new Date(),
  } as Rule;
}

/**
 * Delete a rule (only if not attached to any directories)
 */
export async function deleteRule(
  userId: string,
  ruleId: string
): Promise<{ success: boolean; error?: string }> {
  const ruleRef = db
    .collection('users')
    .doc(userId)
    .collection('rules')
    .doc(ruleId);

  const ruleDoc = await ruleRef.get();
  
  if (!ruleDoc.exists) {
    throw new Error('Rule not found');
  }

  const rule = ruleDoc.data() as Rule;

  // Check if rule is attached to any directories
  if (rule.directoryIds && rule.directoryIds.length > 0) {
    return {
      success: false,
      error: `Cannot delete rule. It is currently attached to ${rule.directoryIds.length} director${rule.directoryIds.length === 1 ? 'y' : 'ies'}. Please detach it first.`,
    };
  }

  await ruleRef.delete();

  return { success: true };
}

/**
 * Attach a rule to a directory
 */
export async function attachRuleToDirectory(
  userId: string,
  ruleId: string,
  directoryId: string
): Promise<void> {
  const batch = db.batch();

  const ruleRef = db
    .collection('users')
    .doc(userId)
    .collection('rules')
    .doc(ruleId);

  // Directories are at root level, not under users
  const directoryRef = db
    .collection('directories')
    .doc(directoryId);

  // Verify both rule and directory exist
  const [ruleDoc, dirDoc] = await Promise.all([
    ruleRef.get(),
    directoryRef.get(),
  ]);

  if (!ruleDoc.exists) {
    throw new Error('Rule not found');
  }

  if (!dirDoc.exists) {
    throw new Error('Directory not found');
  }

  // Add directory ID to rule's directoryIds array (if not already present)
  batch.update(ruleRef, {
    directoryIds: FieldValue.arrayUnion(directoryId),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Add rule ID to directory's ruleIds array (if not already present)
  batch.update(directoryRef, {
    ruleIds: FieldValue.arrayUnion(ruleId),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Detach a rule from a directory
 */
export async function detachRuleFromDirectory(
  userId: string,
  ruleId: string,
  directoryId: string
): Promise<void> {
  const batch = db.batch();

  const ruleRef = db
    .collection('users')
    .doc(userId)
    .collection('rules')
    .doc(ruleId);

  // Directories are at root level, not under users
  const directoryRef = db
    .collection('directories')
    .doc(directoryId);

  // Verify both rule and directory exist
  const [ruleDoc, dirDoc] = await Promise.all([
    ruleRef.get(),
    directoryRef.get(),
  ]);

  if (!ruleDoc.exists) {
    throw new Error('Rule not found');
  }

  if (!dirDoc.exists) {
    throw new Error('Directory not found');
  }

  // Remove directory ID from rule's directoryIds array
  batch.update(ruleRef, {
    directoryIds: FieldValue.arrayRemove(directoryId),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Remove rule ID from directory's ruleIds array
  batch.update(directoryRef, {
    ruleIds: FieldValue.arrayRemove(ruleId),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Get all unique tags used by a user's rules
 */
export async function getRuleTags(userId: string): Promise<string[]> {
  const rules = await getRules(userId);
  
  const tagsSet = new Set<string>();
  rules.forEach(rule => {
    rule.tags.forEach(tag => tagsSet.add(tag));
  });

  return Array.from(tagsSet).sort();
}
