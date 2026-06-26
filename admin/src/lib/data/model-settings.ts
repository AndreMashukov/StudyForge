import 'server-only';

import * as admin from 'firebase-admin';
import type {
  ActiveModelProviderType,
  IEncryptedSecretRecord,
  IGeminiConnectionTestResult,
  IGeminiProviderConnection,
  IMiniMaxConnectionTestResult,
  IMiniMaxProviderConnection,
  IOpenRouterConnectionTestResult,
  IOpenRouterProviderConnection,
  IUpdateGeminiSettingsRequest,
  IUpdateMiniMaxSettingsRequest,
  IUpdateOpenRouterSettingsRequest,
  LlmModality,
} from '@shared-types';
import {
  ALL_LLM_MODALITIES,
  PRIMARY_GEMINI_CONNECTION_ID,
  PRIMARY_MINIMAX_CONNECTION_ID,
  PRIMARY_OPENROUTER_CONNECTION_ID,
} from '@shared-types';
import { requireAdminSession } from '../auth/session';
import { getAdminFirestore } from '../firebase/admin';
import {
  decryptSecret,
  encryptSecret,
  isLlmSettingsEncryptionConfigured,
} from '../security/llm-settings-encryption';

const OPENROUTER_CONNECTION_ID = PRIMARY_OPENROUTER_CONNECTION_ID;
const MINIMAX_CONNECTION_ID = PRIMARY_MINIMAX_CONNECTION_ID;
const GEMINI_CONNECTION_ID = PRIMARY_GEMINI_CONNECTION_ID;
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

function getGeminiConnectionRef(): admin.firestore.DocumentReference {
  return getAdminFirestore()
    .collection(OPENROUTER_CONNECTIONS_COLLECTION)
    .doc(GEMINI_CONNECTION_ID);
}

function getGeminiSecretRef(): admin.firestore.DocumentReference {
  return getAdminFirestore()
    .collection(OPENROUTER_SECRETS_COLLECTION)
    .doc(GEMINI_CONNECTION_ID);
}

function buildDefaultGeminiConnection(
  apiKeyConfigured: boolean
): IGeminiProviderConnection {
  return {
    providerKind: 'gemini',
    label: 'Primary Gemini',
    credentialMode: 'encrypted-firestore',
    apiKeyConfigured,
    supportedModalities: [...ALL_LLM_MODALITIES],
    defaultModel: DEFAULT_GEMINI_MODEL,
    defaultVisionModel: DEFAULT_GEMINI_MODEL,
    defaultImageModel: DEFAULT_GEMINI_IMAGE_MODEL,
    lastValidationStatus: 'unknown',
  };
}

function buildDefaultOpenRouterConnection(
  apiKeyConfigured: boolean
): IOpenRouterProviderConnection {
  return {
    providerKind: 'openrouter',
    label: 'Primary OpenRouter',
    credentialMode: 'encrypted-firestore',
    apiKeyConfigured,
    supportedModalities: [...ALL_LLM_MODALITIES],
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
    providerKind: 'minimax',
    label: 'Primary MiniMax',
    credentialMode: 'encrypted-firestore',
    apiKeyConfigured,
    supportedModalities: [...ALL_LLM_MODALITIES],
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

export async function readGeminiConnection(): Promise<IGeminiProviderConnection> {
  const [connectionSnapshot, secretSnapshot] = await Promise.all([
    getGeminiConnectionRef().get(),
    getGeminiSecretRef().get(),
  ]);

  const defaults = buildDefaultGeminiConnection(secretSnapshot.exists);
  const data = connectionSnapshot.data();

  if (!data) {
    return defaults;
  }

  return {
    ...defaults,
    label: typeof data.label === 'string' ? data.label : defaults.label,
    apiKeyConfigured:
      secretSnapshot.exists || data.apiKeyConfigured === true || defaults.apiKeyConfigured,
    supportedModalities: parseSupportedModalities(data.supportedModalities),
    defaultModel:
      typeof data.defaultModel === 'string' ? data.defaultModel : defaults.defaultModel,
    defaultVisionModel:
      typeof data.defaultVisionModel === 'string'
        ? data.defaultVisionModel.trim() || undefined
        : defaults.defaultVisionModel,
    defaultImageModel:
      typeof data.defaultImageModel === 'string'
        ? normalizeImageModel(data.defaultImageModel, defaults.defaultImageModel ?? DEFAULT_GEMINI_IMAGE_MODEL)
        : defaults.defaultImageModel,
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

export async function readOpenRouterConnection(): Promise<IOpenRouterProviderConnection> {
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
    apiKeyConfigured:
      secretSnapshot.exists || data.apiKeyConfigured === true || defaults.apiKeyConfigured,
    supportedModalities: parseSupportedModalities(data.supportedModalities),
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

export async function readMiniMaxConnection(): Promise<IMiniMaxProviderConnection> {
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
    apiKeyConfigured:
      secretSnapshot.exists || data.apiKeyConfigured === true || defaults.apiKeyConfigured,
    supportedModalities: parseSupportedModalities(data.supportedModalities),
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

  const [geminiConnection, openRouterConnection, miniMaxConnection] = await Promise.all([
    readGeminiConnection(),
    readOpenRouterConnection(),
    readMiniMaxConnection(),
  ]);

  return {
    activeProviderId: 'gemini',
    geminiConnection,
    openRouterConnection,
    miniMaxConnection,
    encryptionConfigured: isLlmSettingsEncryptionConfigured(),
  };
}

export async function setActiveModelProvider(
  providerType: ActiveModelProviderType,
  actorUid: string
): Promise<IModelSettingsPageData> {
  await requireAdminSession();

  if (providerType === 'gemini') {
    const connection = await readGeminiConnection();

    if (!connection.apiKeyConfigured) {
      throw new Error(
        'Gemini API key must be configured before activating this provider.'
      );
    }
  }

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
    providerKind: 'openrouter',
    label: currentConnection.label,
    credentialMode: 'encrypted-firestore',
    apiKeyConfigured: currentConnection.apiKeyConfigured || hasNewApiKey,
    supportedModalities: [...ALL_LLM_MODALITIES],
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
    providerKind: 'minimax',
    label: currentConnection.label,
    credentialMode: 'encrypted-firestore',
    apiKeyConfigured: currentConnection.apiKeyConfigured || hasNewApiKey,
    supportedModalities: [...ALL_LLM_MODALITIES],
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

async function readStoredGeminiApiKey(): Promise<string> {
  if (!isLlmSettingsEncryptionConfigured()) {
    throw new Error('LLM_SETTINGS_ENCRYPTION_KEY is not configured.');
  }

  const snapshot = await getGeminiSecretRef().get();

  if (!snapshot.exists) {
    throw new Error('Gemini API key is not configured.');
  }

  return decryptSecret(readEncryptedSecret(snapshot.data(), 'Gemini'));
}

export async function updateGeminiSettings(
  input: IUpdateGeminiSettingsRequest,
  actorUid: string
): Promise<IGeminiProviderConnection> {
  const currentConnection = await readGeminiConnection();
  const normalizedApiKey = input.apiKey?.trim();
  const hasNewApiKey = Boolean(normalizedApiKey);

  if (!currentConnection.apiKeyConfigured && !hasNewApiKey) {
    throw new Error('Gemini API key is required on first save.');
  }

  if (hasNewApiKey && !isLlmSettingsEncryptionConfigured()) {
    throw new Error('LLM_SETTINGS_ENCRYPTION_KEY is not configured.');
  }

  const payload: Record<string, unknown> = {
    providerKind: 'gemini',
    label: currentConnection.label,
    credentialMode: 'encrypted-firestore',
    apiKeyConfigured: currentConnection.apiKeyConfigured || hasNewApiKey,
    supportedModalities: [...ALL_LLM_MODALITIES],
    defaultModel: normalizeModel(input.defaultModel, 'Gemini'),
    defaultVisionModel: normalizeVisionModel(input.defaultVisionModel),
    defaultImageModel: normalizeImageModel(
      input.defaultImageModel,
      DEFAULT_GEMINI_IMAGE_MODEL
    ),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: actorUid,
  };

  await getGeminiConnectionRef().set(payload, { merge: true });

  if (hasNewApiKey && normalizedApiKey) {
    const encrypted = encryptSecret(normalizedApiKey);
    await getGeminiSecretRef().set(
      {
        ...encrypted,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: actorUid,
      },
      { merge: true }
    );
  }

  return readGeminiConnection();
}

export async function testStoredGeminiConnection(
  actorUid: string
): Promise<{
  geminiConnection: IGeminiProviderConnection;
  result: IGeminiConnectionTestResult;
}> {
  const connection = await readGeminiConnection();

  try {
    const apiKey = await readStoredGeminiApiKey();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'GET',
        cache: 'no-store',
      }
    );
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new Error(
        getResponseErrorMessage(payload, response.status, response.statusText, 'Gemini')
      );
    }

    const modelCount =
      isRecord(payload) && Array.isArray(payload.models) ? payload.models.length : 0;
    const validatedAt = new Date().toISOString();

    await updateValidationStatus(getGeminiConnectionRef(), actorUid, 'healthy', null);

    return {
      geminiConnection: await readGeminiConnection(),
      result: {
        success: true,
        message:
          modelCount > 0
            ? `Validated Gemini access and discovered ${modelCount} available models.`
            : 'Validated Gemini access successfully.',
        validatedAt,
        model: connection.defaultModel,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gemini validation failed.';

    await updateValidationStatus(getGeminiConnectionRef(), actorUid, 'unhealthy', message);

    return {
      geminiConnection: await readGeminiConnection(),
      result: {
        success: false,
        message,
      },
    };
  }
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