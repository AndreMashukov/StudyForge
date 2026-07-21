import 'server-only';

import type {
  IProviderConnectionCatalogEntry,
  ILlmModalityRoute,
  LlmModality,
  LlmProviderKind,
} from '@shared-types';
import {
  ALL_LLM_MODALITIES,
  PRIMARY_GEMINI_CONNECTION_ID,
  PRIMARY_MINIMAX_CONNECTION_ID,
  PRIMARY_OPENROUTER_CONNECTION_ID,
  PRIMARY_TOGETHER_CONNECTION_ID,
} from '@shared-types';
import { requireAdminSession } from '../auth/session';
import { getAdminFirestore } from '../firebase/admin';
import {
  readGeminiConnection,
  readMiniMaxConnection,
  readOpenRouterConnection,
  readTogetherConnection,
} from './model-settings';

const CONNECTIONS_COLLECTION = 'llmProviderConnections';
const SECRETS_COLLECTION = 'llmProviderConnectionSecrets';

const PRIMARY_CONNECTION_IDS = [
  PRIMARY_GEMINI_CONNECTION_ID,
  PRIMARY_OPENROUTER_CONNECTION_ID,
  PRIMARY_MINIMAX_CONNECTION_ID,
  PRIMARY_TOGETHER_CONNECTION_ID,
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseProviderKind(data: Record<string, unknown>): LlmProviderKind | null {
  const kind = data.providerKind ?? data.providerType;
  if (kind === 'gemini' || kind === 'openrouter' || kind === 'minimax' || kind === 'together') {
    return kind;
  }
  return null;
}

function parseSupportedModalities(value: unknown): LlmModality[] {
  if (Array.isArray(value)) {
    const modalities = value.filter(
      (entry): entry is LlmModality =>
        entry === 'text' || entry === 'vision' || entry === 'image'
    );
    if (modalities.length > 0) {
      return modalities;
    }
  }

  return [...ALL_LLM_MODALITIES];
}

async function readCatalogEntry(connectionId: string): Promise<IProviderConnectionCatalogEntry | null> {
  const [connectionSnapshot, secretSnapshot] = await Promise.all([
    getAdminFirestore().collection(CONNECTIONS_COLLECTION).doc(connectionId).get(),
    getAdminFirestore().collection(SECRETS_COLLECTION).doc(connectionId).get(),
  ]);

  if (!connectionSnapshot.exists) {
    return null;
  }

  const data = connectionSnapshot.data();
  if (!isRecord(data)) {
    return null;
  }

  const providerKind = parseProviderKind(data);
  if (!providerKind) {
    return null;
  }

  return {
    id: connectionId,
    providerKind,
    label: typeof data.label === 'string' ? data.label.trim() : connectionId,
    apiKeyConfigured: secretSnapshot.exists || data.apiKeyConfigured === true,
    supportedModalities: parseSupportedModalities(data.supportedModalities),
  };
}

export async function listProviderConnectionCatalog(): Promise<IProviderConnectionCatalogEntry[]> {
  await requireAdminSession();

  const snapshot = await getAdminFirestore().collection(CONNECTIONS_COLLECTION).get();
  const entries: IProviderConnectionCatalogEntry[] = [];

  for (const doc of snapshot.docs) {
    const entry = await readCatalogEntry(doc.id);
    if (entry) {
      entries.push(entry);
    }
  }

  if (entries.length === 0) {
    const [gemini, openRouter, miniMax, together] = await Promise.all([
      readGeminiConnection(),
      readOpenRouterConnection(),
      readMiniMaxConnection(),
      readTogetherConnection(),
    ]);

    return [
      {
        id: PRIMARY_GEMINI_CONNECTION_ID,
        providerKind: 'gemini',
        label: gemini.label,
        apiKeyConfigured: gemini.apiKeyConfigured,
        supportedModalities: gemini.supportedModalities,
      },
      {
        id: PRIMARY_OPENROUTER_CONNECTION_ID,
        providerKind: 'openrouter',
        label: openRouter.label,
        apiKeyConfigured: openRouter.apiKeyConfigured,
        supportedModalities: openRouter.supportedModalities,
      },
      {
        id: PRIMARY_MINIMAX_CONNECTION_ID,
        providerKind: 'minimax',
        label: miniMax.label,
        apiKeyConfigured: miniMax.apiKeyConfigured,
        supportedModalities: miniMax.supportedModalities,
      },
      {
        id: PRIMARY_TOGETHER_CONNECTION_ID,
        providerKind: 'together',
        label: together.label,
        apiKeyConfigured: together.apiKeyConfigured,
        supportedModalities: together.supportedModalities,
      },
    ];
  }

  return entries.sort((a, b) => a.label.localeCompare(b.label));
}

export async function listProviderConnectionsForModality(
  modality: LlmModality
): Promise<IProviderConnectionCatalogEntry[]> {
  const catalog = await listProviderConnectionCatalog();
  return catalog.filter((entry) => entry.supportedModalities.includes(modality));
}

export async function validateModalityRoute(
  route: ILlmModalityRoute,
  modality: LlmModality,
  label: string
): Promise<void> {
  const catalog = await listProviderConnectionCatalog();
  const connection = catalog.find((entry) => entry.id === route.connectionId);

  if (!connection) {
    throw new Error(`${label}: selected provider connection does not exist.`);
  }

  if (!connection.supportedModalities.includes(modality)) {
    throw new Error(
      `${label}: ${connection.label} does not support the ${modality} modality.`
    );
  }

  if (!connection.apiKeyConfigured) {
    throw new Error(`${label}: ${connection.label} credentials are not configured.`);
  }
}

export function getPrimaryConnectionIds(): readonly string[] {
  return PRIMARY_CONNECTION_IDS;
}
