import 'server-only';

import * as admin from 'firebase-admin';
import type {
  IEncryptedSecretRecord,
  IGeminiConnectionTestResult,
  IGeminiProviderConnection,
  IMiniMaxConnectionTestResult,
  IMiniMaxProviderConnection,
  IOpenRouterConnectionTestResult,
  IOpenRouterProviderConnection,
  IProviderAvailableModel,
  ITogetherConnectionTestResult,
  ITogetherProviderConnection,
  IUpdateGeminiSettingsRequest,
  IUpdateMiniMaxSettingsRequest,
  IUpdateOpenRouterSettingsRequest,
  IUpdateTogetherSettingsRequest,
  LlmModality,
  ProviderModelSyncSource,
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
  decryptSecret,
  encryptSecret,
  isLlmSettingsEncryptionConfigured,
} from '../security/llm-settings-encryption';
import {
  assertModelInCatalog,
  normalizeProviderModels,
  parseAvailableModels,
  parseModelsSyncSource,
} from './provider-model-catalog';
import { toIsoString } from './firestore-iso';

const OPENROUTER_CONNECTION_ID = PRIMARY_OPENROUTER_CONNECTION_ID;
const MINIMAX_CONNECTION_ID = PRIMARY_MINIMAX_CONNECTION_ID;
const GEMINI_CONNECTION_ID = PRIMARY_GEMINI_CONNECTION_ID;
const TOGETHER_CONNECTION_ID = PRIMARY_TOGETHER_CONNECTION_ID;
const OPENROUTER_CONNECTIONS_COLLECTION = 'llmProviderConnections';
const OPENROUTER_SECRETS_COLLECTION = 'llmProviderConnectionSecrets';

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
export const DEFAULT_TOGETHER_MODEL = 'MiniMaxAI/MiniMax-M3';
export const DEFAULT_TOGETHER_VISION_MODEL = 'MiniMaxAI/MiniMax-M3';
export const DEFAULT_TOGETHER_IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell';
export const DEFAULT_TOGETHER_BASE_URL = 'https://api.together.ai/v1';

export interface IModelSettingsPageData {
  geminiConnection: IGeminiProviderConnection;
  openRouterConnection: IOpenRouterProviderConnection;
  miniMaxConnection: IMiniMaxProviderConnection;
  togetherConnection: ITogetherProviderConnection;
  encryptionConfigured: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

function getTogetherConnectionRef(): admin.firestore.DocumentReference {
  return getAdminFirestore()
    .collection(OPENROUTER_CONNECTIONS_COLLECTION)
    .doc(TOGETHER_CONNECTION_ID);
}

function getTogetherSecretRef(): admin.firestore.DocumentReference {
  return getAdminFirestore()
    .collection(OPENROUTER_SECRETS_COLLECTION)
    .doc(TOGETHER_CONNECTION_ID);
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

function buildDefaultTogetherConnection(
  apiKeyConfigured: boolean
): ITogetherProviderConnection {
  return {
    providerKind: 'together',
    label: 'Primary Together',
    credentialMode: 'encrypted-firestore',
    apiKeyConfigured,
    supportedModalities: [...ALL_LLM_MODALITIES],
    baseUrl: DEFAULT_TOGETHER_BASE_URL,
    defaultModel: DEFAULT_TOGETHER_MODEL,
    defaultVisionModel: DEFAULT_TOGETHER_VISION_MODEL,
    defaultImageModel: DEFAULT_TOGETHER_IMAGE_MODEL,
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
    availableModels: parseAvailableModels(data.availableModels),
    modelsSyncedAt: toIsoString(data.modelsSyncedAt),
    modelsSyncSource: parseModelsSyncSource(data.modelsSyncSource),
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
  const [connectionSnapshot, secretSnapshot] = await Promise.all([
    getConnectionRef().get(),
    getSecretRef().get(),
  ]);

  const defaults = buildDefaultOpenRouterConnection(secretSnapshot.exists);
  const data = connectionSnapshot.data();

  if (!data) {
    return defaults;
  }

  const defaultImageModel =
    typeof data.defaultImageModel === 'string'
      ? normalizeImageModel(data.defaultImageModel, defaults.defaultImageModel ?? DEFAULT_OPENROUTER_IMAGE_MODEL)
      : defaults.defaultImageModel;

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
    availableModels: parseAvailableModels(data.availableModels),
    modelsSyncedAt: toIsoString(data.modelsSyncedAt),
    modelsSyncSource: parseModelsSyncSource(data.modelsSyncSource),
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
    availableModels: parseAvailableModels(data.availableModels),
    modelsSyncedAt: toIsoString(data.modelsSyncedAt),
    modelsSyncSource: parseModelsSyncSource(data.modelsSyncSource),
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

export async function readTogetherConnection(): Promise<ITogetherProviderConnection> {
  const [connectionSnapshot, secretSnapshot] = await Promise.all([
    getTogetherConnectionRef().get(),
    getTogetherSecretRef().get(),
  ]);

  const defaults = buildDefaultTogetherConnection(secretSnapshot.exists);
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
        ? normalizeImageModel(
            data.defaultImageModel,
            defaults.defaultImageModel ?? DEFAULT_TOGETHER_IMAGE_MODEL
          )
        : defaults.defaultImageModel,
    availableModels: parseAvailableModels(data.availableModels),
    modelsSyncedAt: toIsoString(data.modelsSyncedAt),
    modelsSyncSource: parseModelsSyncSource(data.modelsSyncSource),
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

async function readStoredTogetherApiKey(): Promise<string> {
  if (!isLlmSettingsEncryptionConfigured()) {
    throw new Error('LLM_SETTINGS_ENCRYPTION_KEY is not configured.');
  }

  const snapshot = await getTogetherSecretRef().get();

  if (!snapshot.exists) {
    throw new Error('Together API key is not configured.');
  }

  return decryptSecret(readEncryptedSecret(snapshot.data(), 'Together'));
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

async function persistAvailableModels(
  connectionRef: admin.firestore.DocumentReference,
  actorUid: string,
  models: IProviderAvailableModel[],
  source: ProviderModelSyncSource
): Promise<void> {
  await connectionRef.set(
    {
      availableModels: models,
      modelsSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      modelsSyncSource: source,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actorUid,
    },
    { merge: true }
  );
}

function assertDefaultModelsAgainstCatalog(
  models: IProviderAvailableModel[],
  connectionLabel: string,
  defaults: {
    defaultModel: string;
    defaultVisionModel?: string;
    defaultImageModel?: string;
  }
): void {
  if (models.length === 0) {
    return;
  }

  assertModelInCatalog(
    models,
    defaults.defaultModel,
    'text',
    `${connectionLabel} default text model`,
    connectionLabel
  );

  if (defaults.defaultVisionModel) {
    assertModelInCatalog(
      models,
      defaults.defaultVisionModel,
      'vision',
      `${connectionLabel} default vision model`,
      connectionLabel
    );
  }

  if (defaults.defaultImageModel) {
    assertModelInCatalog(
      models,
      defaults.defaultImageModel,
      'image',
      `${connectionLabel} default image model`,
      connectionLabel
    );
  }
}

const MODEL_CATALOG_FETCH_TIMEOUT_MS = 15_000;

async function fetchModelCatalog(
  url: string,
  init: RequestInit,
  providerLabel: string
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODEL_CATALOG_FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `${providerLabel} model catalog request timed out after ${MODEL_CATALOG_FETCH_TIMEOUT_MS}ms`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchGeminiModelCatalog(apiKey: string): Promise<IProviderAvailableModel[]> {
  const response = await fetchModelCatalog(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'GET',
      cache: 'no-store',
    },
    'Gemini'
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(
      getResponseErrorMessage(payload, response.status, response.statusText, 'Gemini')
    );
  }

  return normalizeProviderModels('gemini', payload);
}

async function fetchOpenRouterModelCatalog(
  baseUrl: string,
  apiKey: string
): Promise<IProviderAvailableModel[]> {
  const response = await fetchModelCatalog(
    `${normalizeBaseUrl(baseUrl, 'OpenRouter')}/models/user`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    },
    'OpenRouter'
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(
      getResponseErrorMessage(payload, response.status, response.statusText, 'OpenRouter')
    );
  }

  return normalizeProviderModels('openrouter', payload);
}

async function fetchMiniMaxModelCatalog(
  baseUrl: string,
  apiKey: string
): Promise<IProviderAvailableModel[]> {
  const response = await fetchModelCatalog(
    `${normalizeBaseUrl(baseUrl, 'MiniMax')}/models`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    },
    'MiniMax'
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(
      getResponseErrorMessage(payload, response.status, response.statusText, 'MiniMax')
    );
  }

  return normalizeProviderModels('minimax', payload);
}

async function fetchTogetherModelCatalog(
  baseUrl: string,
  apiKey: string
): Promise<IProviderAvailableModel[]> {
  const response = await fetchModelCatalog(
    `${normalizeBaseUrl(baseUrl, 'Together')}/models`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    },
    'Together'
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(
      getResponseErrorMessage(payload, response.status, response.statusText, 'Together')
    );
  }

  return normalizeProviderModels('together', payload);
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

export async function getModelSettingsPageData(): Promise<IModelSettingsPageData> {
  await requireAdminSession();

  const [geminiConnection, openRouterConnection, miniMaxConnection, togetherConnection] =
    await Promise.all([
    readGeminiConnection(),
    readOpenRouterConnection(),
    readMiniMaxConnection(),
    readTogetherConnection(),
  ]);

  return {
    geminiConnection,
    openRouterConnection,
    miniMaxConnection,
    togetherConnection,
    encryptionConfigured: isLlmSettingsEncryptionConfigured(),
  };
}

export async function updateOpenRouterSettings(
  input: IUpdateOpenRouterSettingsRequest,
  actorUid: string
): Promise<IOpenRouterProviderConnection> {
  const currentConnection = await readOpenRouterConnection();
  const normalizedApiKey = input.apiKey?.trim();
  const hasNewApiKey = Boolean(normalizedApiKey);
  const nextBaseUrl = normalizeBaseUrl(input.baseUrl, 'OpenRouter');
  const nextDefaultModel = normalizeModel(input.defaultModel, 'OpenRouter');
  const nextDefaultVisionModel = normalizeVisionModel(input.defaultVisionModel);
  const nextDefaultImageModel = normalizeImageModel(
    input.defaultImageModel,
    DEFAULT_OPENROUTER_IMAGE_MODEL
  );

  if (!currentConnection.apiKeyConfigured && !hasNewApiKey) {
    throw new Error('OpenRouter API key is required on first save.');
  }

  if (hasNewApiKey && !isLlmSettingsEncryptionConfigured()) {
    throw new Error('LLM_SETTINGS_ENCRYPTION_KEY is not configured.');
  }

  assertDefaultModelsAgainstCatalog(
    currentConnection.availableModels ?? [],
    currentConnection.label,
    {
      defaultModel: nextDefaultModel,
      defaultVisionModel: nextDefaultVisionModel,
      defaultImageModel: nextDefaultImageModel,
    }
  );

  const payload: Record<string, unknown> = {
    providerKind: 'openrouter',
    label: currentConnection.label,
    credentialMode: 'encrypted-firestore',
    apiKeyConfigured: currentConnection.apiKeyConfigured || hasNewApiKey,
    supportedModalities: [...ALL_LLM_MODALITIES],
    baseUrl: nextBaseUrl,
    defaultModel: nextDefaultModel,
    defaultVisionModel: nextDefaultVisionModel,
    defaultImageModel: nextDefaultImageModel,
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

  const shouldSyncModels =
    hasNewApiKey || nextBaseUrl !== currentConnection.baseUrl;

  if (shouldSyncModels) {
    const apiKey = hasNewApiKey && normalizedApiKey
      ? normalizedApiKey
      : await readStoredOpenRouterApiKey();
    const models = await fetchOpenRouterModelCatalog(nextBaseUrl, apiKey);
    await persistAvailableModels(
      getConnectionRef(),
      actorUid,
      models,
      'provider-save'
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
    const models = await fetchOpenRouterModelCatalog(connection.baseUrl, apiKey);
    const validatedAt = new Date().toISOString();

    await updateValidationStatus(getConnectionRef(), actorUid, 'healthy', null);
    await persistAvailableModels(
      getConnectionRef(),
      actorUid,
      models,
      'provider-test'
    );

    return {
      openRouterConnection: await readOpenRouterConnection(),
      result: {
        success: true,
        message:
          models.length > 0
            ? `Validated OpenRouter access and uploaded ${models.length} available models.`
            : 'Validated OpenRouter access successfully, but no models were returned.',
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
  const nextBaseUrl = normalizeBaseUrl(input.baseUrl, 'MiniMax');
  const nextDefaultModel = normalizeModel(input.defaultModel, 'MiniMax');
  const nextDefaultVisionModel = normalizeVisionModel(input.defaultVisionModel);
  const nextDefaultImageModel = normalizeImageModel(
    input.defaultImageModel,
    DEFAULT_MINIMAX_IMAGE_MODEL
  );

  if (!currentConnection.apiKeyConfigured && !hasNewApiKey) {
    throw new Error('MiniMax API key is required on first save.');
  }

  if (hasNewApiKey && !isLlmSettingsEncryptionConfigured()) {
    throw new Error('LLM_SETTINGS_ENCRYPTION_KEY is not configured.');
  }

  assertDefaultModelsAgainstCatalog(
    currentConnection.availableModels ?? [],
    currentConnection.label,
    {
      defaultModel: nextDefaultModel,
      defaultVisionModel: nextDefaultVisionModel,
      defaultImageModel: nextDefaultImageModel,
    }
  );

  const payload: Record<string, unknown> = {
    providerKind: 'minimax',
    label: currentConnection.label,
    credentialMode: 'encrypted-firestore',
    apiKeyConfigured: currentConnection.apiKeyConfigured || hasNewApiKey,
    supportedModalities: [...ALL_LLM_MODALITIES],
    baseUrl: nextBaseUrl,
    defaultModel: nextDefaultModel,
    defaultVisionModel: nextDefaultVisionModel,
    defaultImageModel: nextDefaultImageModel,
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

  const shouldSyncModels =
    hasNewApiKey || nextBaseUrl !== currentConnection.baseUrl;

  if (shouldSyncModels) {
    const apiKey = hasNewApiKey && normalizedApiKey
      ? normalizedApiKey
      : await readStoredMiniMaxApiKey();
    const models = await fetchMiniMaxModelCatalog(nextBaseUrl, apiKey);
    await persistAvailableModels(
      getMiniMaxConnectionRef(),
      actorUid,
      models,
      'provider-save'
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
  const nextDefaultModel = normalizeModel(input.defaultModel, 'Gemini');
  const nextDefaultVisionModel = normalizeVisionModel(input.defaultVisionModel);
  const nextDefaultImageModel = normalizeImageModel(
    input.defaultImageModel,
    DEFAULT_GEMINI_IMAGE_MODEL
  );

  if (!currentConnection.apiKeyConfigured && !hasNewApiKey) {
    throw new Error('Gemini API key is required on first save.');
  }

  if (hasNewApiKey && !isLlmSettingsEncryptionConfigured()) {
    throw new Error('LLM_SETTINGS_ENCRYPTION_KEY is not configured.');
  }

  assertDefaultModelsAgainstCatalog(
    currentConnection.availableModels ?? [],
    currentConnection.label,
    {
      defaultModel: nextDefaultModel,
      defaultVisionModel: nextDefaultVisionModel,
      defaultImageModel: nextDefaultImageModel,
    }
  );

  const payload: Record<string, unknown> = {
    providerKind: 'gemini',
    label: currentConnection.label,
    credentialMode: 'encrypted-firestore',
    apiKeyConfigured: currentConnection.apiKeyConfigured || hasNewApiKey,
    supportedModalities: [...ALL_LLM_MODALITIES],
    defaultModel: nextDefaultModel,
    defaultVisionModel: nextDefaultVisionModel,
    defaultImageModel: nextDefaultImageModel,
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

  if (hasNewApiKey && normalizedApiKey) {
    const models = await fetchGeminiModelCatalog(normalizedApiKey);
    await persistAvailableModels(
      getGeminiConnectionRef(),
      actorUid,
      models,
      'provider-save'
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
    const models = await fetchGeminiModelCatalog(apiKey);
    const validatedAt = new Date().toISOString();

    await updateValidationStatus(getGeminiConnectionRef(), actorUid, 'healthy', null);
    await persistAvailableModels(
      getGeminiConnectionRef(),
      actorUid,
      models,
      'provider-test'
    );

    return {
      geminiConnection: await readGeminiConnection(),
      result: {
        success: true,
        message:
          models.length > 0
            ? `Validated Gemini access and uploaded ${models.length} available models.`
            : 'Validated Gemini access successfully, but no models were returned.',
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
    const models = await fetchMiniMaxModelCatalog(connection.baseUrl, apiKey);
    const validatedAt = new Date().toISOString();

    await updateValidationStatus(getMiniMaxConnectionRef(), actorUid, 'healthy', null);
    await persistAvailableModels(
      getMiniMaxConnectionRef(),
      actorUid,
      models,
      'provider-test'
    );

    return {
      miniMaxConnection: await readMiniMaxConnection(),
      result: {
        success: true,
        message:
          models.length > 0
            ? `Validated MiniMax access and uploaded ${models.length} available models.`
            : 'Validated MiniMax access successfully, but no models were returned.',
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

export async function updateTogetherSettings(
  input: IUpdateTogetherSettingsRequest,
  actorUid: string
): Promise<ITogetherProviderConnection> {
  const currentConnection = await readTogetherConnection();
  const normalizedApiKey = input.apiKey?.trim();
  const hasNewApiKey = Boolean(normalizedApiKey);
  const nextBaseUrl = normalizeBaseUrl(input.baseUrl, 'Together');
  const nextDefaultModel = normalizeModel(input.defaultModel, 'Together');
  const nextDefaultVisionModel = normalizeVisionModel(input.defaultVisionModel);
  const nextDefaultImageModel = normalizeImageModel(
    input.defaultImageModel,
    DEFAULT_TOGETHER_IMAGE_MODEL
  );

  if (!currentConnection.apiKeyConfigured && !hasNewApiKey) {
    throw new Error('Together API key is required on first save.');
  }

  if (hasNewApiKey && !isLlmSettingsEncryptionConfigured()) {
    throw new Error('LLM_SETTINGS_ENCRYPTION_KEY is not configured.');
  }

  assertDefaultModelsAgainstCatalog(
    currentConnection.availableModels ?? [],
    currentConnection.label,
    {
      defaultModel: nextDefaultModel,
      defaultVisionModel: nextDefaultVisionModel,
      defaultImageModel: nextDefaultImageModel,
    }
  );

  const payload: Record<string, unknown> = {
    providerKind: 'together',
    label: currentConnection.label,
    credentialMode: 'encrypted-firestore',
    apiKeyConfigured: currentConnection.apiKeyConfigured || hasNewApiKey,
    supportedModalities: [...ALL_LLM_MODALITIES],
    baseUrl: nextBaseUrl,
    defaultModel: nextDefaultModel,
    defaultVisionModel: nextDefaultVisionModel,
    defaultImageModel: nextDefaultImageModel,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: actorUid,
  };

  await getTogetherConnectionRef().set(payload, { merge: true });

  if (hasNewApiKey && normalizedApiKey) {
    const encrypted = encryptSecret(normalizedApiKey);
    await getTogetherSecretRef().set(
      {
        ...encrypted,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: actorUid,
      },
      { merge: true }
    );
  }

  const shouldSyncModels =
    hasNewApiKey || nextBaseUrl !== currentConnection.baseUrl;

  if (shouldSyncModels) {
    const apiKey = hasNewApiKey && normalizedApiKey
      ? normalizedApiKey
      : await readStoredTogetherApiKey();
    const models = await fetchTogetherModelCatalog(nextBaseUrl, apiKey);
    await persistAvailableModels(
      getTogetherConnectionRef(),
      actorUid,
      models,
      'provider-save'
    );
  }

  return readTogetherConnection();
}

export async function testStoredTogetherConnection(
  actorUid: string
): Promise<{
  togetherConnection: ITogetherProviderConnection;
  result: ITogetherConnectionTestResult;
}> {
  const connection = await readTogetherConnection();

  try {
    const apiKey = await readStoredTogetherApiKey();
    const models = await fetchTogetherModelCatalog(connection.baseUrl, apiKey);
    const validatedAt = new Date().toISOString();

    await updateValidationStatus(getTogetherConnectionRef(), actorUid, 'healthy', null);
    await persistAvailableModels(
      getTogetherConnectionRef(),
      actorUid,
      models,
      'provider-test'
    );

    return {
      togetherConnection: await readTogetherConnection(),
      result: {
        success: true,
        message:
          models.length > 0
            ? `Validated Together access and uploaded ${models.length} available models.`
            : 'Validated Together access successfully, but no models were returned.',
        validatedAt,
        model: connection.defaultModel,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Together validation failed.';

    await updateValidationStatus(getTogetherConnectionRef(), actorUid, 'unhealthy', message);

    return {
      togetherConnection: await readTogetherConnection(),
      result: {
        success: false,
        message,
      },
    };
  }
}