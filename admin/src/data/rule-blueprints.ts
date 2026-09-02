import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import type {
  ICreateRuleBlueprintRequest,
  IRuleBlueprint,
  IUpdateRuleBlueprintRequest,
  RuleBlueprintStatus,
} from '@shared-types';
import { parseRuleBlueprintForm } from '@shared-types';
import { requireAdminSession } from '../auth/session';
import { getAdminApp, getAdminFirestore } from '../firebase/admin';

const COLLECTION = 'platformRuleBlueprints';

interface IRuleBlueprintUpdates {
  name?: string;
  description?: string | FirebaseFirestore.FieldValue;
  content?: string;
  color?: IRuleBlueprint['color'];
  tags?: string[];
  applicableTo?: IRuleBlueprint['applicableTo'];
  status?: RuleBlueprintStatus;
  version?: number;
  updatedAt?: string;
  updatedBy?: string;
  publishedAt?: string | FirebaseFirestore.FieldValue;
  publishedBy?: string | FirebaseFirestore.FieldValue;
  sourceUserId?: string;
  sourceRuleId?: string;
}

function parseBlueprint(
  id: string,
  data: FirebaseFirestore.DocumentData,
): IRuleBlueprint | null {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const content = typeof data.content === 'string' ? data.content : '';
  const status = data.status;
  const color = data.color;
  const applicableTo = Array.isArray(data.applicableTo) ? data.applicableTo : [];
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const version = typeof data.version === 'number' ? data.version : 1;

  if (
    !name ||
    !content ||
    (status !== 'draft' && status !== 'published' && status !== 'archived')
  ) {
    return null;
  }

  return {
    id,
    name,
    description:
      typeof data.description === 'string' ? data.description : undefined,
    content,
    color,
    tags: tags.filter((tag): tag is string => typeof tag === 'string'),
    applicableTo: applicableTo.filter(
      (value): value is IRuleBlueprint['applicableTo'][number] =>
        typeof value === 'string',
    ),
    status,
    version,
    createdAt:
      typeof data.createdAt === 'string'
        ? data.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof data.updatedAt === 'string'
        ? data.updatedAt
        : new Date().toISOString(),
    createdBy:
      typeof data.createdBy === 'string' ? data.createdBy : undefined,
    updatedBy:
      typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
    publishedAt:
      typeof data.publishedAt === 'string' ? data.publishedAt : undefined,
    publishedBy:
      typeof data.publishedBy === 'string' ? data.publishedBy : undefined,
    sourceUserId:
      typeof data.sourceUserId === 'string' ? data.sourceUserId : undefined,
    sourceRuleId:
      typeof data.sourceRuleId === 'string' ? data.sourceRuleId : undefined,
  };
}

function validatePayload(
  payload: ICreateRuleBlueprintRequest,
): ICreateRuleBlueprintRequest {
  return parseRuleBlueprintForm(payload);
}

export async function listRuleBlueprints(): Promise<IRuleBlueprint[]> {
  await requireAdminSession();
  getAdminApp();

  const snapshot = await getAdminFirestore()
    .collection(COLLECTION)
    .orderBy('updatedAt', 'desc')
    .get();

  const blueprints: IRuleBlueprint[] = [];
  for (const doc of snapshot.docs) {
    const parsed = parseBlueprint(doc.id, doc.data());
    if (parsed) {
      blueprints.push(parsed);
    }
  }
  return blueprints;
}

export async function getRuleBlueprint(
  blueprintId: string,
): Promise<IRuleBlueprint | null> {
  await requireAdminSession();
  getAdminApp();

  const doc = await getAdminFirestore()
    .collection(COLLECTION)
    .doc(blueprintId)
    .get();
  if (!doc.exists) {
    return null;
  }
  return parseBlueprint(doc.id, doc.data() ?? {});
}

export async function createRuleBlueprint(
  payload: ICreateRuleBlueprintRequest,
  adminUid: string,
): Promise<IRuleBlueprint> {
  await requireAdminSession();
  getAdminApp();

  const validated = validatePayload(payload);
  const now = new Date().toISOString();
  const ref = getAdminFirestore().collection(COLLECTION).doc();

  const record: IRuleBlueprint = {
    id: ref.id,
    name: validated.name,
    description: validated.description,
    content: validated.content,
    color: validated.color,
    tags: validated.tags,
    applicableTo: validated.applicableTo,
    status: 'draft',
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: adminUid,
    updatedBy: adminUid,
  };

  await ref.set(record);
  return record;
}

export async function updateRuleBlueprint(
  blueprintId: string,
  payload: IUpdateRuleBlueprintRequest,
  adminUid: string,
): Promise<IRuleBlueprint> {
  await requireAdminSession();
  getAdminApp();

  const existing = await getRuleBlueprint(blueprintId);
  if (!existing) {
    throw new Error('Rule blueprint not found.');
  }

  const merged: ICreateRuleBlueprintRequest = {
    name: payload.name?.trim() ?? existing.name,
    description: payload.description ?? existing.description,
    content: payload.content ?? existing.content,
    color: payload.color ?? existing.color,
    tags: payload.tags ?? existing.tags,
    applicableTo: payload.applicableTo ?? existing.applicableTo,
  };
  const validated = validatePayload(merged);
  const now = new Date().toISOString();

  const updates: IRuleBlueprintUpdates = {
    name: validated.name,
    description: validated.description?.trim()
      ? validated.description.trim()
      : FieldValue.delete(),
    content: validated.content,
    color: validated.color,
    tags: validated.tags,
    applicableTo: validated.applicableTo,
    updatedAt: now,
    updatedBy: adminUid,
  };

  if (existing.status === 'published') {
    updates.version = existing.version + 1;
    updates.status = 'draft';
    updates.publishedAt = FieldValue.delete();
    updates.publishedBy = FieldValue.delete();
  }

  await getAdminFirestore()
    .collection(COLLECTION)
    .doc(blueprintId)
    .set(updates, { merge: true });

  const updated = await getRuleBlueprint(blueprintId);
  if (!updated) {
    throw new Error('Failed to load updated rule blueprint.');
  }
  return updated;
}

export async function publishRuleBlueprint(
  blueprintId: string,
  adminUid: string,
): Promise<IRuleBlueprint> {
  await requireAdminSession();
  getAdminApp();

  const existing = await getRuleBlueprint(blueprintId);
  if (!existing) {
    throw new Error('Rule blueprint not found.');
  }

  const now = new Date().toISOString();
  await getAdminFirestore()
    .collection(COLLECTION)
    .doc(blueprintId)
    .set(
      {
        status: 'published' satisfies RuleBlueprintStatus,
        publishedAt: now,
        publishedBy: adminUid,
        updatedAt: now,
        updatedBy: adminUid,
      },
      { merge: true },
    );

  const published = await getRuleBlueprint(blueprintId);
  if (!published) {
    throw new Error('Failed to load published rule blueprint.');
  }
  return published;
}

export async function archiveRuleBlueprint(blueprintId: string): Promise<void> {
  await requireAdminSession();
  getAdminApp();

  const existing = await getRuleBlueprint(blueprintId);
  if (!existing) {
    throw new Error('Rule blueprint not found.');
  }

  const now = new Date().toISOString();
  await getAdminFirestore()
    .collection(COLLECTION)
    .doc(blueprintId)
    .set(
      {
        status: 'archived' satisfies RuleBlueprintStatus,
        updatedAt: now,
      },
      { merge: true },
    );
}

export async function deleteRuleBlueprint(blueprintId: string): Promise<void> {
  await requireAdminSession();
  getAdminApp();
  await getAdminFirestore().collection(COLLECTION).doc(blueprintId).delete();
}

export async function upsertSeedRuleBlueprint(
  record: IRuleBlueprint,
): Promise<IRuleBlueprint> {
  getAdminApp();
  await getAdminFirestore().collection(COLLECTION).doc(record.id).set(record);
  return record;
}
