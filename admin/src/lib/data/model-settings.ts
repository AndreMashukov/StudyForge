import 'server-only';

import * as admin from 'firebase-admin';
import type {
  ActiveModelProviderType,
  IEncryptedSecretRecord,
  IGeminiProviderConnection,
  IOpenRouterConnectionTestResult,
  IOpenRouterProviderConnection,
  IUpdateOpenRouterSettingsRequest,
} from '@shared-types';
import { requireAdminSession } from '../auth/session';
import { getAdminFirestore } from '../firebase/admin';
import {
  decryptSecret,
  encryptSecret,
  isLlmSettingsEncryptionConfigured,
} from '../security/llm-settings-encryption';

const OPENROUTER_CONNECTION_ID = 'openrouter-primary';
const LEGACY_GEMINI_IMAGE_CONNECTION_ID = 'gemini-image-primary';
const OPENROUTER_CONNECTIONS_COLLECTION = 'llmProviderConnections';
const OPENROUTER_SECRETS_COLLECTION = 'llmProviderConnectionSecrets';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
export const DEFAULT_OPENROUTER_MODEL = 'openrouter/auto';
export const DEFAULT_OPENROUTER_VISION_MODEL = 'google/gemini-2.5-flash';
export const DEFAULT_OPENROUTER_IMAGE_MODEL = 'google/gemini-3.1-flash-image-preview';
export const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export interface IModelSettingsPageData {
  activeProviderId: ActiveModelProviderType;
  geminiConnection: IGeminiProviderConnection;
  openRouterConnection: IOpenRouterProviderConnection;
  encryptionConfigured: boolean;
}

export function isActiveModelProviderType(
  value: unknown
): value is ActiveModelProviderType {
  return value === 'gemini' || value === 'openrouter';
}

function resolveActiveProviderId(
  openRouterConnection: IOpenRouterProviderConnection
): ActiveModelProviderType {
  return openRouterConnection.enabled ? 'openrouter' : 'gemini';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toIsoString(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return undefined;
}

function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim();

  if (!normalized) {
    throw new Error('OpenRouter base URL is required.');
  }

  const url = new URL(normalized);
  return url.toString().replace(/\/$/, '');
}

function normalizeModel(model: string): string {
  const normalized = model.trim();

  if (!normalized) {
    throw new Error('OpenRouter default model is required.');
  }

  return normalized;
}

function normalizeVisionModel(model: string | undefined): string | undefined {
  if (model === undefined) {
    return undefined;
  }

  const normalized = model.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeImageModel(model: string | undefined): string {
  const normalized = model?.trim();
  return normalized && normalized.length > 0 ? normalized : DEFAULT_OPENROUTER_IMAGE_MODEL;
}

function toOpenRouterImageModelId(geminiModelId: string): string {
  const normalized = geminiModelId.trim();
  if (normalized.includes('/')) {
    return normalized;
  }
  return `google/${normalized}`;
}

function getConnectionRef(): admin.firestore.DocumentReference {
  return getAdminFirestore()
    .collection(OPENROUTER_CONNECTIONS_COLLECTION)
    .doc(OPENROUTER_CONNECTION_ID);
}

function getLegacyGeminiImageConnectionRef(): admin.firestore.DocumentReference {
  return getAdminFirestore()
    .collection(OPENROUTER_CONNECTIONS_COLLECTION)
    .doc(LEGACY_GEMINI_IMAGE_CONNECTION_ID);
}

function getSecretRef(): admin.firestore.DocumentReference {
  return getAdminFirestore()
    .collection(OPENROUTER_SECRETS_COLLECTION)
    .doc(OPENROUTER_CONNECTION_ID);
}

function buildGeminiConnection(): IGeminiProviderConnection {
  return {
    providerType: 'gemini',
    label: 'Gemini (server managed)',
    enabled: true,
    credentialMode: 'deployment-secret',
    secretRef: 'GEMINI_API_KEY',
    defaultModel: DEFAULT_GEMINI_MODEL,
    lastValidationStatus: 'unknown',
  };
}

function buildDefaultOpenRouterConnection(
  apiKeyConfigured: boolean
): IOpenRouterProviderConnection {
  return {
    providerType: 'openrouter',
    label: 'Primary OpenRouter',
    enabled: false,
    credentialMode: 'encrypted-firestore',
    apiKeyConfigured,
    baseUrl: DEFAULT_OPENROUTER_BASE_URL,
    defaultModel: DEFAULT_OPENROUTER_MODEL,
    defaultVisionModel: DEFAULT_OPENROUTER_VISION_MODEL,
    defaultImageModel: DEFAULT_OPENROUTER_IMAGE_MODEL,
    lastValidationStatus: 'unknown',
  };
}

function readHeaders(
  value: unknown
): IOpenRouterProviderConnection['headers'] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const httpReferer =
    typeof value.httpReferer === 'string' ? value.httpReferer : undefined;
  const title = typeof value.title === 'string' ? value.title : undefined;

  if (!httpReferer && !title) {
    return undefined;
  }

  return { httpReferer, title };
}

function readPreferences(
  value: unknown
): IOpenRouterProviderConnection['providerPreferences'] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const order = Array.isArray(value.order)
    ? value.order.filter((item): item is string => typeof item === 'string')
    : undefined;
  const allowFallbacks =
    typeof value.allowFallbacks === 'boolean'
      ? value.allowFallbacks
      : undefined;
  const zdr = typeof value.zdr === 'boolean' ? value.zdr : undefined;
  const sort =
    value.sort === 'latency' ||
    value.sort === 'throughput' ||
    value.sort === 'price'
      ? value.sort
      : undefined;

  if (!order?.length && allowFallbacks === undefined && !sort && zdr === undefined) {
    return undefined;
  }

  return {
    order,
    allowFallbacks,
    sort,
    zdr,
  };
}

async function readLegacyGeminiImageModel(): Promise<string | undefined> {
  const snapshot = await getLegacyGeminiImageConnectionRef().get();
  const data = snapshot.data();
  if (!data || typeof data.defaultModel !== 'string') {
    return undefined;
  }

  return toOpenRouterImageModelId(data.defaultModel);
}

async function readOpenRouterConnection(): Promise<IOpenRouterProviderConnection> {
  const [connectionSnapshot, secretSnapshot, legacyImageModel] = await Promise.all([
    getConnectionRef().get(),
    getSecretRef().get(),
    readLegacyGeminiImageModel(),
  ]);

  const defaults = buildDefaultOpenRouterConnection(secretSnapshot.exists);
  const data = connectionSnapshot.data();

  if (!data) {
    return {
      ...defaults,
      defaultImageModel: legacyImageModel ?? defaults.defaultImageModel,
    };
  }

  const defaultImageModel =
    typeof data.defaultImageModel === 'string'
      ? normalizeImageModel(data.defaultImageModel)
      : legacyImageModel ?? defaults.defaultImageModel;

  return {
    ...defaults,
    label: typeof data.label === 'string' ? data.label : defaults.label,
    enabled:
      typeof data.enabled === 'boolean' ? data.enabled : defaults.enabled,
    apiKeyConfigured:
      secretSnapshot.exists || data.apiKeyConfigured === true || defaults.apiKeyConfigured,
    baseUrl:
      typeof data.baseUrl === 'string' ? data.baseUrl : defaults.baseUrl,
    defaultModel:
      typeof data.defaultModel === 'string'
        ? data.defaultModel
        : defaults.defaultModel,
    defaultVisionModel:
      typeof data.defaultVisionModel === 'string'
        ? data.defaultVisionModel.trim() || undefined
        : defaults.defaultVisionModel,
    defaultImageModel,
    headers: readHeaders(data.headers),
    providerPreferences: readPreferences(data.providerPreferences),
    updatedAt: toIsoString(data.updatedAt),
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
    lastValidatedAt: toIsoString(data.lastValidatedAt),
    lastValidationError:
      typeof data.lastValidationError === 'string'
        ? data.lastValidationError
        : data.lastValidationError === null
          ? null
          : undefined,
    lastValidationStatus:
      data.lastValidationStatus === 'healthy' ||
      data.lastValidationStatus === 'unhealthy' ||
      data.lastValidationStatus === 'unknown'
        ? data.lastValidationStatus
        : defaults.lastValidationStatus,
  };
}

function readEncryptedSecret(data: unknown): IEncryptedSecretRecord {
  if (!isRecord(data)) {
    throw new Error('Stored OpenRouter credential is malformed.');
  }

  if (
    typeof data.version !== 'number' ||
    data.version !== 1 ||
    data.algorithm !== 'aes-256-gcm' ||
    typeof data.iv !== 'string' ||
    typeof data.authTag !== 'string' ||
    typeof data.ciphertext !== 'string'
  ) {
    throw new Error('Stored OpenRouter credential is malformed.');
  }

  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: data.iv,
    authTag: data.authTag,
    ciphertext: data.ciphertext,
    updatedAt: toIsoString(data.updatedAt),
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
  };
}

async function readStoredOpenRouterApiKey(): Promise<string> {
  if (!isLlmSettingsEncryptionConfigured()) {
    throw new Error('LLM_SETTINGS_ENCRYPTION_KEY is not configured.');
  }

  const snapshot = await getSecretRef().get();

  if (!snapshot.exists) {
    throw new Error('OpenRouter API key is not configured.');
  }

  return decryptSecret(readEncryptedSecret(snapshot.data()));
}

async function updateValidationStatus(
  actorUid: string,
  status: 'healthy' | 'unhealthy',
  errorMessage: string | null
): Promise<void> {
  await getConnectionRef().set(
    {
      lastValidationStatus: status,
      lastValidationAt: admin.firestore.FieldValue.serverTimestamp(),
      lastValidatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastValidationError: errorMessage,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actorUid,
    },
    { merge: true }
  );
}

function getResponseErrorMessage(
  payload: unknown,
  status: number,
  fallbackText: string
): string {
  if (isRecord(payload)) {
    if (
      'error' in payload &&
      isRecord(payload.error) &&
      typeof payload.error.message === 'string'
    ) {
      return `OpenRouter request failed (${status}): ${payload.error.message}`;
    }

    if (typeof payload.message === 'string') {
      return `OpenRouter request failed (${status}): ${payload.message}`;
    }
  }

  return `OpenRouter request failed (${status}): ${fallbackText}`;
}

export async function getModelSettingsPageData(): Promise<IModelSettingsPageData> {
  await requireAdminSession();

  const openRouterConnection = await readOpenRouterConnection();

  return {
    activeProviderId: resolveActiveProviderId(openRouterConnection),
    geminiConnection: {
      ...buildGeminiConnection(),
      enabled: !openRouterConnection.enabled,
    },
    openRouterConnection,
    encryptionConfigured: isLlmSettingsEncryptionConfigured(),
  };
}

export async function setActiveModelProvider(
  providerType: ActiveModelProviderType,
  actorUid: string
): Promise<IModelSettingsPageData> {
  await requireAdminSession();

  if (providerType === 'openrouter') {
    const connection = await readOpenRouterConnection();

    if (!connection.apiKeyConfigured) {
      throw new Error(
        'OpenRouter API key must be configured before activating this provider.'
      );
    }

    await getConnectionRef().set(
      {
        enabled: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: actorUid,
      },
      { merge: true }
    );
  } else {
    await getConnectionRef().set(
      {
        enabled: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: actorUid,
      },
      { merge: true }
    );
  }

  return getModelSettingsPageData();
}

export async function updateOpenRouterSettings(
  input: IUpdateOpenRouterSettingsRequest,
  actorUid: string
): Promise<IOpenRouterProviderConnection> {
  const currentConnection = await readOpenRouterConnection();
  const normalizedApiKey = input.apiKey?.trim();
  const hasNewApiKey = Boolean(normalizedApiKey);

  if (!currentConnection.apiKeyConfigured && !hasNewApiKey) {
    throw new Error('OpenRouter API key is required on first save.');
  }

  if (hasNewApiKey && !isLlmSettingsEncryptionConfigured()) {
    throw new Error('LLM_SETTINGS_ENCRYPTION_KEY is not configured.');
  }

  const payload: Record<string, unknown> = {
    providerType: 'openrouter',
    label: currentConnection.label,
    enabled: input.enabled ?? currentConnection.enabled,
    credentialMode: 'encrypted-firestore',
    apiKeyConfigured: currentConnection.apiKeyConfigured || hasNewApiKey,
    baseUrl: normalizeBaseUrl(input.baseUrl),
    defaultModel: normalizeModel(input.defaultModel),
    defaultVisionModel: normalizeVisionModel(input.defaultVisionModel),
    defaultImageModel: normalizeImageModel(input.defaultImageModel),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: actorUid,
  };

  if (input.headers) {
    payload.headers = input.headers;
  }

  await getConnectionRef().set(payload, { merge: true });

  if (hasNewApiKey && normalizedApiKey) {
    const encrypted = encryptSecret(normalizedApiKey);
    await getSecretRef().set(
      {
        ...encrypted,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: actorUid,
      },
      { merge: true }
    );
  }

  return readOpenRouterConnection();
}

export async function testStoredOpenRouterConnection(
  actorUid: string
): Promise<{
  openRouterConnection: IOpenRouterProviderConnection;
  result: IOpenRouterConnectionTestResult;
}> {
  const connection = await readOpenRouterConnection();

  try {
    const apiKey = await readStoredOpenRouterApiKey();
    const response = await fetch(
      `${normalizeBaseUrl(connection.baseUrl)}/models/user`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new Error(
        getResponseErrorMessage(payload, response.status, response.statusText)
      );
    }

    const modelCount =
      isRecord(payload) && Array.isArray(payload.data) ? payload.data.length : 0;
    const validatedAt = new Date().toISOString();

    await updateValidationStatus(actorUid, 'healthy', null);

    return {
      openRouterConnection: await readOpenRouterConnection(),
      result: {
        success: true,
        message:
          modelCount > 0
            ? `Validated OpenRouter access and discovered ${modelCount} available models.`
            : 'Validated OpenRouter access successfully.',
        validatedAt,
        model: connection.defaultModel,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'OpenRouter validation failed.';

    await updateValidationStatus(actorUid, 'unhealthy', message);

    return {
      openRouterConnection: await readOpenRouterConnection(),
      result: {
        success: false,
        message,
      },
    };
  }
}