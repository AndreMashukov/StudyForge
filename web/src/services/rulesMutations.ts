import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type {
  CreateRuleRequest,
  DeleteRuleResponse,
  Rule,
  UpdateRuleRequest,
} from '@shared-types';
import { db } from '../config/firebase';
import { directoryRef, ruleRef } from './firestorePaths';
import { fetchRuleFromFirestore } from './rulesFirestore';

export async function createRuleInFirestore(
  userId: string,
  request: CreateRuleRequest,
): Promise<Rule> {
  if (request.content.length > 100000) {
    throw new Error('Rule content cannot exceed 100,000 characters');
  }
  if (!request.applicableTo || request.applicableTo.length === 0) {
    throw new Error('Rule must be applicable to at least one operation type');
  }

  const ruleDocRef = doc(collection(db, 'users', userId, 'rules'));
  const now = new Date();

  const ruleData = {
    id: ruleDocRef.id,
    userId,
    name: request.name,
    description: request.description || '',
    content: request.content,
    color: request.color,
    tags: request.tags || [],
    applicableTo: request.applicableTo,
    isDefault: request.isDefault || false,
    directoryIds: [],
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ruleDocRef, {
    ...ruleData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    ...ruleData,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateRuleInFirestore(
  userId: string,
  request: UpdateRuleRequest,
): Promise<Rule> {
  const existing = await fetchRuleFromFirestore(userId, request.ruleId);
  if (!existing) {
    throw new Error('Rule not found');
  }

  if (request.content && request.content.length > 100000) {
    throw new Error('Rule content cannot exceed 100,000 characters');
  }
  if (request.applicableTo && request.applicableTo.length === 0) {
    throw new Error('Rule must be applicable to at least one operation type');
  }

  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (request.name !== undefined) updateData.name = request.name;
  if (request.description !== undefined) updateData.description = request.description;
  if (request.content !== undefined) updateData.content = request.content;
  if (request.color !== undefined) updateData.color = request.color;
  if (request.tags !== undefined) updateData.tags = request.tags;
  if (request.applicableTo !== undefined) updateData.applicableTo = request.applicableTo;
  if (request.isDefault !== undefined) updateData.isDefault = request.isDefault;

  await updateDoc(ruleRef(userId, request.ruleId), updateData);

  const updated = await fetchRuleFromFirestore(userId, request.ruleId);
  if (!updated) {
    throw new Error('Rule not found after update');
  }
  return updated;
}

export async function deleteRuleInFirestore(
  userId: string,
  ruleId: string,
): Promise<DeleteRuleResponse> {
  const existing = await fetchRuleFromFirestore(userId, ruleId);
  if (!existing) {
    throw new Error('Rule not found');
  }

  if (existing.directoryIds && existing.directoryIds.length > 0) {
    return {
      success: false,
      error: `Cannot delete rule. It is currently attached to ${existing.directoryIds.length} director${existing.directoryIds.length === 1 ? 'y' : 'ies'}. Please detach it first.`,
    };
  }

  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(ruleRef(userId, ruleId));
  return { success: true };
}

export async function attachRuleToDirectoryInFirestore(
  userId: string,
  ruleId: string,
  directoryId: string,
): Promise<void> {
  const batch = writeBatch(db);
  const ruleDocRef = ruleRef(userId, ruleId);
  const dirDocRef = directoryRef(userId, directoryId);

  const [ruleSnap, dirSnap] = await Promise.all([
    getDoc(ruleDocRef),
    getDoc(dirDocRef),
  ]);

  if (!ruleSnap.exists()) {
    throw new Error('Rule not found');
  }
  if (!dirSnap.exists()) {
    throw new Error('Directory not found');
  }

  batch.update(ruleDocRef, {
    directoryIds: arrayUnion(directoryId),
    updatedAt: serverTimestamp(),
  });
  batch.update(dirDocRef, {
    ruleIds: arrayUnion(ruleId),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function detachRuleFromDirectoryInFirestore(
  userId: string,
  ruleId: string,
  directoryId: string,
): Promise<void> {
  const batch = writeBatch(db);
  const ruleDocRef = ruleRef(userId, ruleId);
  const dirDocRef = directoryRef(userId, directoryId);

  const [ruleSnap, dirSnap] = await Promise.all([
    getDoc(ruleDocRef),
    getDoc(dirDocRef),
  ]);

  if (!ruleSnap.exists()) {
    throw new Error('Rule not found');
  }
  if (!dirSnap.exists()) {
    throw new Error('Directory not found');
  }

  batch.update(ruleDocRef, {
    directoryIds: arrayRemove(directoryId),
    updatedAt: serverTimestamp(),
  });
  batch.update(dirDocRef, {
    ruleIds: arrayRemove(ruleId),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function formatRulesForPromptClient(
  userId: string,
  ruleIds: string[],
): Promise<string> {
  if (ruleIds.length === 0) {
    return '';
  }

  const rules = await Promise.all(
    ruleIds.map((id) => fetchRuleFromFirestore(userId, id)),
  );
  const validRules = rules.filter((rule): rule is Rule => rule !== null);

  if (validRules.length === 0) {
    return '';
  }

  return validRules
    .map((rule, index) => {
      const header = `### Rule ${index + 1}: ${rule.name}`;
      const description = rule.description ? `\n${rule.description}` : '';
      return `${header}${description}\n\n${rule.content}`;
    })
    .join('\n\n---\n\n');
}
