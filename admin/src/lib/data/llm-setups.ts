import 'server-only';

import type {
  ICreateLlmSetupRequest,
  ILlmModalityRoute,
  ILlmSetup,
  ILlmSetupRoutes,
  IUpdateLlmSetupRequest,
  LlmProviderType,
} from '@shared-types';
import * as admin from 'firebase-admin';
import { requireAdminSession } from '../auth/session';
import { getAdminFirestore } from '../firebase/admin';
import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_MINIMAX_IMAGE_MODEL,
  DEFAULT_MINIMAX_MODEL,
  DEFAULT_MINIMAX_VISION_MODEL,
  DEFAULT_OPENROUTER_IMAGE_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_OPENROUTER_VISION_MODEL,
  getModelSettingsPageData,
} from './model-settings';

const LLM_SETUPS_COLLECTION = 'llmSetups';
const USER_GROUPS_COLLECTION = 'userGroups';

export interface IAdminLlmSetupSummary extends ILlmSetup {
  referencedGroupCount: number;
  providerWarnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isProviderType(value: unknown): value is LlmProviderType {
  return value === 'gemini' || value === 'openrouter' || value === 'minimax';
}

function parseModalityRoute(value: unknown): ILlmModalityRoute | null {
  if (!isRecord(value) || !isProviderType(value.providerType)) {
    return null;
  }

  const model = typeof value.model === 'string' ? value.model.trim() : '';
  if (!model) {
    return null;
  }

  return {
    providerType: value.providerType,
    model,
  };
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

function normalizeModalityRoute(route: ILlmModalityRoute, label: string): ILlmModalityRoute {
  const model = route.model.trim();
  if (!model) {
    throw new Error(`${label} model is required.`);
  }

  return {
    providerType: route.providerType,
    model,
  };
}

function normalizeRoutes(routes: ILlmSetupRoutes): ILlmSetupRoutes {
  return {
    text: normalizeModalityRoute(routes.text, 'Text'),
    vision: normalizeModalityRoute(routes.vision, 'Vision'),
    image: normalizeModalityRoute(routes.image, 'Image'),
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

export function createDefaultLlmSetupRoutes(): ILlmSetupRoutes {
  return {
    text: { providerType: 'gemini', model: DEFAULT_GEMINI_MODEL },
    vision: { providerType: 'gemini', model: DEFAULT_GEMINI_MODEL },
    image: { providerType: 'gemini', model: DEFAULT_GEMINI_IMAGE_MODEL },
  };
}

export function createOpenRouterDefaultRoutes(): ILlmSetupRoutes {
  return {
    text: { providerType: 'openrouter', model: DEFAULT_OPENROUTER_MODEL },
    vision: { providerType: 'openrouter', model: DEFAULT_OPENROUTER_VISION_MODEL },
    image: { providerType: 'openrouter', model: DEFAULT_OPENROUTER_IMAGE_MODEL },
  };
}

export function createMiniMaxDefaultRoutes(): ILlmSetupRoutes {
  return {
    text: { providerType: 'minimax', model: DEFAULT_MINIMAX_MODEL },
    vision: { providerType: 'minimax', model: DEFAULT_MINIMAX_VISION_MODEL },
    image: { providerType: 'minimax', model: DEFAULT_MINIMAX_IMAGE_MODEL },
  };
}

async function buildProviderWarnings(routes: ILlmSetupRoutes): Promise<string[]> {
  const pageData = await getModelSettingsPageData();
  const warnings: string[] = [];

  const providers = new Set<LlmProviderType>([
    routes.text.providerType,
    routes.vision.providerType,
    routes.image.providerType,
  ]);

  for (const providerType of providers) {
    if (providerType === 'openrouter') {
      if (
        !pageData.openRouterConnection.enabled ||
        !pageData.openRouterConnection.apiKeyConfigured
      ) {
        warnings.push('OpenRouter credentials are not configured.');
      }
    }

    if (providerType === 'minimax') {
      if (!pageData.miniMaxConnection.enabled || !pageData.miniMaxConnection.apiKeyConfigured) {
        warnings.push('MiniMax credentials are not configured.');
      }
    }
  }

  return warnings;
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

  const snapshot = await getAdminFirestore().collection(LLM_SETUPS_COLLECTION).get();

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
    });
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getLlmSetupById(setupId: string): Promise<IAdminLlmSetupSummary | null> {
  await requireAdminSession();

  const doc = await getAdminFirestore().collection(LLM_SETUPS_COLLECTION).doc(setupId).get();
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

  const routes = normalizeRoutes(input.routes);
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
    routes: input.routes ? normalizeRoutes(input.routes) : current.routes,
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
