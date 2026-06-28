import 'server-only';

import type {
  GenerationKind,
  ICreateLlmSetupRequest,
  IGenerationRoute,
  IGenerationRoutes,
  ILlmModalityRoute,
  ILlmSetup,
  IUpdateLlmSetupRequest,
  LlmModality,
} from '@shared-types';
import {
  ALL_GENERATION_KINDS,
  GENERATION_KIND_METADATA,
  isGenerationKind,
  isGenerationWorkflow,
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

function parseGenerationRoute(value: unknown): IGenerationRoute | null {
  if (!isRecord(value)) {
    return null;
  }

  const connectionId =
    typeof value.connectionId === 'string' ? value.connectionId.trim() : '';
  const model = typeof value.model === 'string' ? value.model.trim() : '';
  const modality = value.modality;
  const workflow = value.workflow;

  if (
    !connectionId ||
    !model ||
    (modality !== 'text' && modality !== 'vision' && modality !== 'image') ||
    typeof workflow !== 'string' ||
    !isGenerationWorkflow(workflow)
  ) {
    return null;
  }

  return {
    connectionId,
    model,
    modality,
    workflow,
  };
}

function parseGenerationRoutes(value: unknown): IGenerationRoutes | null {
  if (!isRecord(value)) {
    return null;
  }

  const routes = {} as IGenerationRoutes;

  for (const kind of ALL_GENERATION_KINDS) {
    const route = parseGenerationRoute(value[kind]);
    if (!route) {
      return null;
    }
    routes[kind] = route;
  }

  return routes;
}

function parseLlmSetup(id: string, data: FirebaseFirestore.DocumentData): ILlmSetup | null {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const generationRoutes = parseGenerationRoutes(data.generationRoutes);

  if (!name || !generationRoutes) {
    return null;
  }

  return {
    id,
    name,
    description: typeof data.description === 'string' ? data.description : undefined,
    generationRoutes,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
  };
}

async function validateGenerationRoute(
  kind: GenerationKind,
  route: IGenerationRoute
): Promise<IGenerationRoute> {
  const metadata = GENERATION_KIND_METADATA[kind];
  const label = metadata.label;
  const connectionId = route.connectionId.trim();
  const model = route.model.trim();

  if (!model) {
    throw new Error(`${label}: model is required.`);
  }

  if (!connectionId) {
    throw new Error(`${label}: provider connection is required.`);
  }

  if (route.modality !== metadata.requiredModality) {
    throw new Error(
      `${label}: modality must be ${metadata.requiredModality}, got ${route.modality}.`
    );
  }

  if (!metadata.supportedWorkflows.includes(route.workflow)) {
    throw new Error(`${label}: workflow ${route.workflow} is not supported.`);
  }

  await validateModalityRoute({ connectionId, model }, metadata.requiredModality, label);

  return {
    connectionId,
    model,
    modality: metadata.requiredModality,
    workflow: route.workflow,
  };
}

async function normalizeGenerationRoutes(routes: IGenerationRoutes): Promise<IGenerationRoutes> {
  const normalized = {} as IGenerationRoutes;

  for (const kind of ALL_GENERATION_KINDS) {
    if (!isGenerationKind(kind)) {
      throw new Error(`Unknown generation kind: ${kind}`);
    }

    normalized[kind] = await validateGenerationRoute(kind, routes[kind]);
  }

  return normalized;
}

function rejectLegacyRoutesPayload(body: Record<string, unknown>): void {
  if ('routes' in body) {
    throw new Error('Legacy routes are no longer accepted. Use generationRoutes.');
  }
}

function toFirestoreLlmSetupDocument(
  setup: ILlmSetup,
  options?: { clearDescription?: boolean }
): FirebaseFirestore.DocumentData {
  const document: FirebaseFirestore.DocumentData = {
    id: setup.id,
    name: setup.name,
    generationRoutes: setup.generationRoutes,
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

export async function createDefaultGenerationRoutes(): Promise<IGenerationRoutes> {
  const gemini = await readGeminiConnection();

  const routesByModality: Record<LlmModality, ILlmModalityRoute> = {
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

  const generationRoutes = {} as IGenerationRoutes;

  for (const kind of ALL_GENERATION_KINDS) {
    const metadata = GENERATION_KIND_METADATA[kind];
    const source = routesByModality[metadata.requiredModality];
    generationRoutes[kind] = {
      connectionId: source.connectionId,
      model: source.model,
      modality: metadata.requiredModality,
      workflow: metadata.defaultWorkflow,
    };
  }

  return generationRoutes;
}

async function buildProviderWarnings(generationRoutes: IGenerationRoutes): Promise<string[]> {
  const catalog = await listProviderConnectionCatalog();
  const warnings: string[] = [];
  const connectionIds = new Set<string>();

  for (const kind of ALL_GENERATION_KINDS) {
    connectionIds.add(generationRoutes[kind].connectionId);
  }

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
  generationRoutes: IGenerationRoutes,
  catalog: Awaited<ReturnType<typeof listProviderConnectionCatalog>>
): Record<string, string> {
  const labels: Record<string, string> = {};
  const connectionIds = new Set<string>();

  for (const kind of ALL_GENERATION_KINDS) {
    connectionIds.add(generationRoutes[kind].connectionId);
  }

  for (const connectionId of connectionIds) {
    const connection = catalog.find((entry) => entry.id === connectionId);
    labels[connectionId] = connection
      ? `${connection.label} (${connection.providerKind})`
      : connectionId;
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
      providerWarnings: await buildProviderWarnings(setup.generationRoutes),
      connectionLabels: buildConnectionLabels(setup.generationRoutes, catalog),
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
    providerWarnings: await buildProviderWarnings(setup.generationRoutes),
    connectionLabels: buildConnectionLabels(setup.generationRoutes, catalog),
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

  const generationRoutes = await normalizeGenerationRoutes(input.generationRoutes);
  const now = new Date().toISOString();
  const docRef = getAdminFirestore().collection(LLM_SETUPS_COLLECTION).doc();

  const setup: ILlmSetup = {
    id: docRef.id,
    name,
    description: input.description?.trim() || undefined,
    generationRoutes,
    updatedAt: now,
    updatedBy: adminUid,
  };

  await docRef.set(toFirestoreLlmSetupDocument(setup));
  return setup;
}

export async function createLlmSetupFromRequest(
  body: Record<string, unknown>,
  adminUid: string
): Promise<ILlmSetup> {
  rejectLegacyRoutesPayload(body);

  const name = typeof body.name === 'string' ? body.name : '';
  const description = typeof body.description === 'string' ? body.description : undefined;
  const generationRoutes = parseGenerationRoutes(body.generationRoutes);

  if (!generationRoutes) {
    throw new Error('generationRoutes must include every generation kind.');
  }

  return createLlmSetup({ name, description, generationRoutes }, adminUid);
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
    generationRoutes: input.generationRoutes
      ? await normalizeGenerationRoutes(input.generationRoutes)
      : current.generationRoutes,
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

export async function updateLlmSetupFromRequest(
  setupId: string,
  body: Record<string, unknown>,
  adminUid: string
): Promise<ILlmSetup> {
  rejectLegacyRoutesPayload(body);

  const input: IUpdateLlmSetupRequest = {};

  if (typeof body.name === 'string') {
    input.name = body.name;
  }

  if (typeof body.description === 'string') {
    input.description = body.description;
  }

  if (body.generationRoutes !== undefined) {
    const generationRoutes = parseGenerationRoutes(body.generationRoutes);
    if (!generationRoutes) {
      throw new Error('generationRoutes must include every generation kind.');
    }
    input.generationRoutes = generationRoutes;
  }

  return updateLlmSetup(setupId, input, adminUid);
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
