import 'server-only';

import type {
  ICreateLlmSetupRequest,
  ILlmModalityRoute,
  ILlmSetup,
  ILlmSetupRoutes,
  IUpdateLlmSetupRequest,
  LlmModality,
} from '@shared-types';
import {
  PRIMARY_GEMINI_CONNECTION_ID,
} from '@shared-types';
import * as admin from 'firebase-admin';
import { requireAdminSession } from '../auth/session';
import { getAdminFirestore } from '../firebase/admin';
import { readGeminiConnection } from './model-settings';
import {
  listProviderConnectionCatalog,
  validateModalityRoute,
} from './provider-connections';

const LLM_SETUPS_COLLECTION = 'llmSetups';
const USER_GROUPS_COLLECTION = 'userGroups';

export interface IAdminLlmSetupSummary extends ILlmSetup {
  referencedGroupCount: number;
  providerWarnings: string[];
  connectionLabels: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseModalityRoute(value: unknown): ILlmModalityRoute | null {
  if (!isRecord(value)) {
    return null;
  }

  const connectionId =
    typeof value.connectionId === 'string' ? value.connectionId.trim() : '';
  const model = typeof value.model === 'string' ? value.model.trim() : '';

  if (!connectionId || !model) {
    return null;
  }

  return { connectionId, model };
}

function parseRoutes(value: unknown): ILlmSetupRoutes | null {
  if (!isRecord(value)) {
    return null;
  }

  const text = parseModalityRoute(value.text);
  const vision = parseModalityRoute(value.vision);
  const image = parseModalityRoute(value.image);

  if (!text || !vision || !image) {
    return null;
  }

  return { text, vision, image };
}

function parseLlmSetup(id: string, data: FirebaseFirestore.DocumentData): ILlmSetup | null {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const routes = parseRoutes(data.routes);

  if (!name || !routes) {
    return null;
  }

  return {
    id,
    name,
    description: typeof data.description === 'string' ? data.description : undefined,
    routes,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
  };
}

async function normalizeModalityRoute(
  route: ILlmModalityRoute,
  modality: LlmModality,
  label: string
): Promise<ILlmModalityRoute> {
  const model = route.model.trim();
  const connectionId = route.connectionId.trim();

  if (!model) {
    throw new Error(`${label} model is required.`);
  }

  if (!connectionId) {
    throw new Error(`${label} provider connection is required.`);
  }

  await validateModalityRoute({ connectionId, model }, modality, label);

  return { connectionId, model };
}

async function normalizeRoutes(routes: ILlmSetupRoutes): Promise<ILlmSetupRoutes> {
  return {
    text: await normalizeModalityRoute(routes.text, 'text', 'Text'),
    vision: await normalizeModalityRoute(routes.vision, 'vision', 'Vision'),
    image: await normalizeModalityRoute(routes.image, 'image', 'Image'),
  };
}

function toFirestoreLlmSetupDocument(
  setup: ILlmSetup,
  options?: { clearDescription?: boolean }
): FirebaseFirestore.DocumentData {
  const document: FirebaseFirestore.DocumentData = {
    id: setup.id,
    name: setup.name,
    routes: setup.routes,
    updatedAt: setup.updatedAt,
    updatedBy: setup.updatedBy,
  };

  if (options?.clearDescription) {
    document.description = admin.firestore.FieldValue.delete();
  } else if (setup.description !== undefined) {
    document.description = setup.description;
  }

  return document;
}

export async function createDefaultLlmSetupRoutes(): Promise<ILlmSetupRoutes> {
  const gemini = await readGeminiConnection();

  return {
    text: { connectionId: PRIMARY_GEMINI_CONNECTION_ID, model: gemini.defaultModel },
    vision: {
      connectionId: PRIMARY_GEMINI_CONNECTION_ID,
      model: gemini.defaultVisionModel ?? gemini.defaultModel,
    },
    image: {
      connectionId: PRIMARY_GEMINI_CONNECTION_ID,
      model: gemini.defaultImageModel ?? gemini.defaultModel,
    },
  };
}

async function buildProviderWarnings(routes: ILlmSetupRoutes): Promise<string[]> {
  const catalog = await listProviderConnectionCatalog();
  const warnings: string[] = [];
  const connectionIds = new Set([
    routes.text.connectionId,
    routes.vision.connectionId,
    routes.image.connectionId,
  ]);

  for (const connectionId of connectionIds) {
    const connection = catalog.find((entry) => entry.id === connectionId);
    if (!connection) {
      warnings.push(`Provider connection ${connectionId} does not exist.`);
      continue;
    }

    if (!connection.apiKeyConfigured) {
      warnings.push(`${connection.label} credentials are not configured.`);
    }
  }

  return warnings;
}

function buildConnectionLabels(
  routes: ILlmSetupRoutes,
  catalog: Awaited<ReturnType<typeof listProviderConnectionCatalog>>
): Record<string, string> {
  const labels: Record<string, string> = {};

  for (const route of [routes.text, routes.vision, routes.image]) {
    const connection = catalog.find((entry) => entry.id === route.connectionId);
    labels[route.connectionId] = connection
      ? `${connection.label} (${connection.providerKind})`
      : route.connectionId;
  }

  return labels;
}

async function countGroupsForSetup(setupId: string): Promise<number> {
  const snapshot = await getAdminFirestore()
    .collection(USER_GROUPS_COLLECTION)
    .where('llmSetupId', '==', setupId)
    .get();

  return snapshot.size;
}

export async function listLlmSetups(): Promise<IAdminLlmSetupSummary[]> {
  await requireAdminSession();

  const [snapshot, catalog] = await Promise.all([
    getAdminFirestore().collection(LLM_SETUPS_COLLECTION).get(),
    listProviderConnectionCatalog(),
  ]);

  const summaries: IAdminLlmSetupSummary[] = [];

  for (const doc of snapshot.docs) {
    const setup = parseLlmSetup(doc.id, doc.data());
    if (!setup) {
      continue;
    }

    summaries.push({
      ...setup,
      referencedGroupCount: await countGroupsForSetup(doc.id),
      providerWarnings: await buildProviderWarnings(setup.routes),
      connectionLabels: buildConnectionLabels(setup.routes, catalog),
    });
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getLlmSetupById(setupId: string): Promise<IAdminLlmSetupSummary | null> {
  await requireAdminSession();

  const [doc, catalog] = await Promise.all([
    getAdminFirestore().collection(LLM_SETUPS_COLLECTION).doc(setupId).get(),
    listProviderConnectionCatalog(),
  ]);

  if (!doc.exists) {
    return null;
  }

  const setup = parseLlmSetup(doc.id, doc.data() ?? {});
  if (!setup) {
    return null;
  }

  return {
    ...setup,
    referencedGroupCount: await countGroupsForSetup(doc.id),
    providerWarnings: await buildProviderWarnings(setup.routes),
    connectionLabels: buildConnectionLabels(setup.routes, catalog),
  };
}

export async function createLlmSetup(
  input: ICreateLlmSetupRequest,
  adminUid: string
): Promise<ILlmSetup> {
  await requireAdminSession();

  const name = input.name.trim();
  if (!name) {
    throw new Error('Setup name is required.');
  }

  const routes = await normalizeRoutes(input.routes);
  const now = new Date().toISOString();
  const docRef = getAdminFirestore().collection(LLM_SETUPS_COLLECTION).doc();

  const setup: ILlmSetup = {
    id: docRef.id,
    name,
    description: input.description?.trim() || undefined,
    routes,
    updatedAt: now,
    updatedBy: adminUid,
  };

  await docRef.set(toFirestoreLlmSetupDocument(setup));
  return setup;
}

export async function updateLlmSetup(
  setupId: string,
  input: IUpdateLlmSetupRequest,
  adminUid: string
): Promise<ILlmSetup> {
  await requireAdminSession();

  const docRef = getAdminFirestore().collection(LLM_SETUPS_COLLECTION).doc(setupId);
  const existing = await docRef.get();

  if (!existing.exists) {
    throw new Error('LLM setup not found.');
  }

  const current = parseLlmSetup(existing.id, existing.data() ?? {});
  if (!current) {
    throw new Error('LLM setup data is invalid.');
  }

  const descriptionChanged = input.description !== undefined;
  const trimmedDescription = input.description?.trim();
  const nextDescription = descriptionChanged
    ? trimmedDescription || undefined
    : current.description;

  const next: ILlmSetup = {
    ...current,
    name: input.name?.trim() || current.name,
    description: nextDescription,
    routes: input.routes ? await normalizeRoutes(input.routes) : current.routes,
    updatedAt: new Date().toISOString(),
    updatedBy: adminUid,
  };

  if (!next.name.trim()) {
    throw new Error('Setup name is required.');
  }

  await docRef.set(
    toFirestoreLlmSetupDocument(next, {
      clearDescription: descriptionChanged && nextDescription === undefined,
    }),
    { merge: true }
  );
  return next;
}

export async function deleteLlmSetup(setupId: string): Promise<void> {
  await requireAdminSession();

  const groupsSnapshot = await getAdminFirestore()
    .collection(USER_GROUPS_COLLECTION)
    .where('llmSetupId', '==', setupId)
    .get();

  if (!groupsSnapshot.empty) {
    const groupNames = groupsSnapshot.docs
      .map((doc) => (typeof doc.data().name === 'string' ? doc.data().name : doc.id))
      .join(', ');

    throw new Error(
      `Cannot delete setup because it is assigned to user groups: ${groupNames}. Reassign those groups first.`
    );
  }

  await getAdminFirestore().collection(LLM_SETUPS_COLLECTION).doc(setupId).delete();
}

export async function listLlmSetupOptions(): Promise<Array<{ id: string; name: string }>> {
  const setups = await listLlmSetups();
  return setups.map(({ id, name }) => ({ id, name }));
}

export async function ensureSetupExists(setupId: string): Promise<void> {
  const doc = await getAdminFirestore().collection(LLM_SETUPS_COLLECTION).doc(setupId).get();
  if (!doc.exists) {
    throw new Error('Selected LLM setup does not exist.');
  }
}
