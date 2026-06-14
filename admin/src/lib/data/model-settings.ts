import 'server-only';

import * as admin from 'firebase-admin';
import type {
  ActiveModelProviderType,
  IEncryptedSecretRecord,
  IGeminiProviderConnection,
  IMiniMaxConnectionTestResult,
  IMiniMaxProviderConnection,
  IOpenRouterConnectionTestResult,
  IOpenRouterProviderConnection,
  IUpdateMiniMaxSettingsRequest,
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
const MINIMAX_CONNECTION_ID = 'minimax-primary';
const LEGACY_GEMINI_IMAGE_CONNECTION_ID = 'gemini-image-primary';
const OPENROUTER_CONNECTIONS_COLLECTION = 'llmProviderConnections';
const OPENROUTER_SECRETS_COLLECTION = 'llmProviderConnectionSecrets';
const ACTIVE_PROVIDER_COLLECTION = 'llmSettings';
const ACTIVE_PROVIDER_DOC_ID = 'activeProvider';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
export const DEFAULT_OPENROUTER_MODEL = 'openrouter/auto';
export const DEFAULT_OPENROUTER_VISION_MODEL = 'google/gemini-2.5-flash';
export const DEFAULT_OPENROUTER_IMAGE_MODEL = 'google/gemini-3.1-flash-image-preview';
export const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const DEFAULT_MINIMAX_MODEL = 'MiniMax-M3';
export const DEFAULT_MINIMAX_VISION_MODEL = 'MiniMax-M3';
export const DEFAULT_MINIMAX_IMAGE_MODEL = 'image-01';
export const DEFAULT_MINIMAX_BASE_URL = 'https://api.minimax.io/v1';
export const DEFAULT_MINIMAX_IMAGE_URL = 'https://api.minimax.io/v1/image_generation';

export interface IModelSettingsPageData {
  activeProviderId: ActiveModelProviderType;
  geminiConnection: IGeminiProviderConnection;
  openRouterConnection: IOpenRouterProviderConnection;
  miniMaxConnection: IMiniMaxProviderConnection;
  encryptionConfigured: boolean;
}

export function isActiveModelProviderType(
  value: unknown
): value is ActiveModelProviderType {
  return value === 'gemini' || value === 'openrouter' || value === 'minimax';
}

function resolveActiveProviderIdLegacy(
  openRouterConnection: IOpenRouterProviderConnection
): ActiveModelProviderType {
  return openRouterConnection.enabled ? 'openrouter' : 'gemini';
}

async function readActiveProviderId(
  openRouterConnection: IOpenRouterProviderConnection,
  miniMaxConnection: IMiniMaxProviderConnection
): Promise<ActiveModelProviderType> {
  const snapshot = await getActiveProviderRef().get();
  const data = snapshot.data();

  if (data && isActiveModelProviderType(data.activeProviderId)) {
    return data.activeProviderId;
  }

  if (miniMaxConnection.enabled) {
    return 'minimax';
  }

  return resolveActiveProviderIdLegacy(openRouterConnection);
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

function normalizeBaseUrl(baseUrl: string, providerLabel: string): string {
  const normalized = baseUrl.trim();

  if (!normalized) {
    throw new Error(`${providerLabel} base URL is required.`);
  }

  const url = new URL(normalized);
  return url.toString().replace(/\/$/, '');
}

function normalizeModel(model: string, providerLabel: string): string {
  const normalized = model.trim();

  if (!normalized) {
    throw new Error(`${providerLabel} default model is required.`);
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

function normalizeImageModel(
  model: string | undefined,
  fallback: string
): string {
  const normalized = model?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function getActiveProviderRef(): admin.firestore.DocumentReference {
  return getAdminFirestore()
    .collection(ACTIVE_PROVIDER_COLLECTION)
    .doc(ACTIVE_PROVIDER_DOC_ID);
}

function getConnectionRef(): admin.firestore.DocumentReference {
  return getAdminFirestore()
    .collection(OPENROUTER_CONNECTIONS_COLLECTION)
    .doc(OPENROUTER_CONNECTION_ID);
}

function getMiniMaxConnectionRef(): admin.firestore.DocumentReference {
  return getAdminFirestore()
    .collection(OPENROUTER_CONNECTIONS_COLLECTION)
    .doc(MINIMAX_CONNECTION_ID);
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

function getMiniMaxSecretRef(): admin.firestore.DocumentReference {
  return getAdminFirestore()
    .collection(OPENROUTER_SECRETS_COLLECTION)
    .doc(MINIMAX_CONNECTION_ID);
}

function toOpenRouterImageModelId(geminiModelId: string): string {
  const normalized = geminiModelId.trim();
  if (normalized.includes('/')) {
    return normalized;
  }
  return `google/${normalized}`;
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

function buildDefaultMiniMaxConnection(
  apiKeyConfigured: boolean
): IMiniMaxProviderConnection {
  return {
    providerType: 'minimax',
    label: 'Primary MiniMax',
    enabled: false,
    credentialMode: 'encrypted-firestore',
    apiKeyConfigured,
    baseUrl: DEFAULT_MINIMAX_BASE_URL,
    defaultModel: DEFAULT_MINIMAX_MODEL,
    defaultVisionModel: DEFAULT_MINIMAX_VISION_MODEL,
    defaultImageModel: DEFAULT_MINIMAX_IMAGE_MODEL,
    imageGenerationUrl: DEFAULT_MINIMAX_IMAGE_URL,
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
      ? normalizeImageModel(data.defaultImageModel, defaults.defaultImageModel ?? DEFAULT_OPENROUTER_IMAGE_MODEL)
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

async function readMiniMaxConnection(): Promise<IMiniMaxProviderConnection> {
  const [connectionSnapshot, secretSnapshot] = await Promise.all([
    getMiniMaxConnectionRef().get(),
    getMiniMaxSecretRef().get(),
  ]);

  const defaults = buildDefaultMiniMaxConnection(secretSnapshot.exists);
  const data = connectionSnapshot.data();

  if (!data) {
    return defaults;
  }

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
    defaultImageModel:
      typeof data.defaultImageModel === 'string'
        ? normalizeImageModel(data.defaultImageModel, defaults.defaultImageModel ?? DEFAULT_MINIMAX_IMAGE_MODEL)
        : defaults.defaultImageModel,
    imageGenerationUrl:
      typeof data.imageGenerationUrl === 'string'
        ? data.imageGenerationUrl
        : defaults.imageGenerationUrl,
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

function readEncryptedSecret(data: unknown, providerLabel: string): IEncryptedSecretRecord {
  if (!isRecord(data)) {
    throw new Error(`Stored ${providerLabel} credential is malformed.`);
  }

  if (
    typeof data.version !== 'number' ||
    data.version !== 1 ||
    data.algorithm !== 'aes-256-gcm' ||
    typeof data.iv !== 'string' ||
    typeof data.authTag !== 'string' ||
    typeof data.ciphertext !== 'string'
  ) {
    throw new Error(`Stored ${providerLabel} credential is malformed.`);
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

  return decryptSecret(readEncryptedSecret(snapshot.data(), 'OpenRouter'));
}

async function readStoredMiniMaxApiKey(): Promise<string> {
  if (!isLlmSettingsEncryptionConfigured()) {
    throw new Error('LLM_SETTINGS_ENCRYPTION_KEY is not configured.');
  }

  const snapshot = await getMiniMaxSecretRef().get();

  if (!snapshot.exists) {
    throw new Error('MiniMax API key is not configured.');
  }

  return decryptSecret(readEncryptedSecret(snapshot.data(), 'MiniMax'));
}

async function updateValidationStatus(
  connectionRef: admin.firestore.DocumentReference,
  actorUid: string,
  status: 'healthy' | 'unhealthy',
  errorMessage: string | null
): Promise<void> {
  await connectionRef.set(
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
  fallbackText: string,
  providerLabel: string
): string {
  if (isRecord(payload)) {
    if (
      'error' in payload &&
      isRecord(payload.error) &&
      typeof payload.error.message === 'string'
    ) {
      return `${providerLabel} request failed (${status}): ${payload.error.message}`;
    }

    if (
      'base_resp' in payload &&
      isRecord(payload.base_resp) &&
      typeof payload.base_resp.status_msg === 'string'
    ) {
      return `${providerLabel} request failed (${status}): ${payload.base_resp.status_msg}`;
    }

    if (typeof payload.message === 'string') {
      return `${providerLabel} request failed (${status}): ${payload.message}`;
    }
  }

  return `${providerLabel} request failed (${status}): ${fallbackText}`;
}

async function writeActiveProviderId(
  providerType: ActiveModelProviderType,
  actorUid: string
): Promise<void> {
  await getActiveProviderRef().set(
    {
      activeProviderId: providerType,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actorUid,
    },
    { merge: true }
  );
}

export async function getModelSettingsPageData(): Promise<IModelSettingsPageData> {
  await requireAdminSession();

  const [openRouterConnection, miniMaxConnection] = await Promise.all([
    readOpenRouterConnection(),
    readMiniMaxConnection(),
  ]);
  const activeProviderId = await readActiveProviderId(
    openRouterConnection,
    miniMaxConnection
  );

  return {
    activeProviderId,
    geminiConnection: {
      ...buildGeminiConnection(),
      enabled: activeProviderId === 'gemini',
    },
    openRouterConnection: {
      ...openRouterConnection,
      enabled: activeProviderId === 'openrouter',
    },
    miniMaxConnection: {
      ...miniMaxConnection,
      enabled: activeProviderId === 'minimax',
    },
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
  }

  if (providerType === 'minimax') {
    const connection = await readMiniMaxConnection();

    if (!connection.apiKeyConfigured) {
      throw new Error(
        'MiniMax API key must be configured before activating this provider.'
      );
    }
  }

  await writeActiveProviderId(providerType, actorUid);

  await getConnectionRef().set(
    {
      enabled: providerType === 'openrouter',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actorUid,
    },
    { merge: true }
  );

  await getMiniMaxConnectionRef().set(
    {
      enabled: providerType === 'minimax',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actorUid,
    },
    { merge: true }
  );

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
    baseUrl: normalizeBaseUrl(input.baseUrl, 'OpenRouter'),
    defaultModel: normalizeModel(input.defaultModel, 'OpenRouter'),
    defaultVisionModel: normalizeVisionModel(input.defaultVisionModel),
    defaultImageModel: normalizeImageModel(
      input.defaultImageModel,
      DEFAULT_OPENROUTER_IMAGE_MODEL
    ),
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
      `${normalizeBaseUrl(connection.baseUrl, 'OpenRouter')}/models/user`,
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
        getResponseErrorMessage(payload, response.status, response.statusText, 'OpenRouter')
      );
    }

    const modelCount =
      isRecord(payload) && Array.isArray(payload.data) ? payload.data.length : 0;
    const validatedAt = new Date().toISOString();

    await updateValidationStatus(getConnectionRef(), actorUid, 'healthy', null);

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

    await updateValidationStatus(getConnectionRef(), actorUid, 'unhealthy', message);

    return {
      openRouterConnection: await readOpenRouterConnection(),
      result: {
        success: false,
        message,
      },
    };
  }
}

export async function updateMiniMaxSettings(
  input: IUpdateMiniMaxSettingsRequest,
  actorUid: string
): Promise<IMiniMaxProviderConnection> {
  const currentConnection = await readMiniMaxConnection();
  const normalizedApiKey = input.apiKey?.trim();
  const hasNewApiKey = Boolean(normalizedApiKey);

  if (!currentConnection.apiKeyConfigured && !hasNewApiKey) {
    throw new Error('MiniMax API key is required on first save.');
  }

  if (hasNewApiKey && !isLlmSettingsEncryptionConfigured()) {
    throw new Error('LLM_SETTINGS_ENCRYPTION_KEY is not configured.');
  }

  const payload: Record<string, unknown> = {
    providerType: 'minimax',
    label: currentConnection.label,
    enabled: input.enabled ?? currentConnection.enabled,
    credentialMode: 'encrypted-firestore',
    apiKeyConfigured: currentConnection.apiKeyConfigured || hasNewApiKey,
    baseUrl: normalizeBaseUrl(input.baseUrl, 'MiniMax'),
    defaultModel: normalizeModel(input.defaultModel, 'MiniMax'),
    defaultVisionModel: normalizeVisionModel(input.defaultVisionModel),
    defaultImageModel: normalizeImageModel(
      input.defaultImageModel,
      DEFAULT_MINIMAX_IMAGE_MODEL
    ),
    imageGenerationUrl: normalizeBaseUrl(input.imageGenerationUrl, 'MiniMax image'),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: actorUid,
  };

  await getMiniMaxConnectionRef().set(payload, { merge: true });

  if (hasNewApiKey && normalizedApiKey) {
    const encrypted = encryptSecret(normalizedApiKey);
    await getMiniMaxSecretRef().set(
      {
        ...encrypted,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: actorUid,
      },
      { merge: true }
    );
  }

  return readMiniMaxConnection();
}

export async function testStoredMiniMaxConnection(
  actorUid: string
): Promise<{
  miniMaxConnection: IMiniMaxProviderConnection;
  result: IMiniMaxConnectionTestResult;
}> {
  const connection = await readMiniMaxConnection();

  try {
    const apiKey = await readStoredMiniMaxApiKey();
    const response = await fetch(
      `${normalizeBaseUrl(connection.baseUrl, 'MiniMax')}/models`,
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
        getResponseErrorMessage(payload, response.status, response.statusText, 'MiniMax')
      );
    }

    const modelCount =
      isRecord(payload) && Array.isArray(payload.data) ? payload.data.length : 0;
    const validatedAt = new Date().toISOString();

    await updateValidationStatus(getMiniMaxConnectionRef(), actorUid, 'healthy', null);

    return {
      miniMaxConnection: await readMiniMaxConnection(),
      result: {
        success: true,
        message:
          modelCount > 0
            ? `Validated MiniMax access and discovered ${modelCount} available models.`
            : 'Validated MiniMax access successfully.',
        validatedAt,
        model: connection.defaultModel,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'MiniMax validation failed.';

    await updateValidationStatus(getMiniMaxConnectionRef(), actorUid, 'unhealthy', message);

    return {
      miniMaxConnection: await readMiniMaxConnection(),
      result: {
        success: false,
        message,
      },
    };
  }
}