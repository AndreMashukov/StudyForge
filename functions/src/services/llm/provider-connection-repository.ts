import * as admin from 'firebase-admin';
import type { IEncryptedSecretRecord, LlmModality, LlmProviderKind } from '@shared-types';
import { ALL_LLM_MODALITIES } from '@shared-types';

const CONNECTIONS_COLLECTION = 'llmProviderConnections';
const SECRETS_COLLECTION = 'llmProviderConnectionSecrets';

export interface IStoredProviderConnection {
  id: string;
  providerKind: LlmProviderKind;
  label: string;
  apiKeyConfigured: boolean;
  supportedModalities: LlmModality[];
  baseUrl?: string;
  imageGenerationUrl?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseProviderKind(data: Record<string, unknown>): LlmProviderKind | null {
  const kind = data.providerKind ?? data.providerType;
  if (kind === 'gemini' || kind === 'openrouter' || kind === 'minimax') {
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

export class ProviderConnectionRepository {
  static async getById(connectionId: string): Promise<IStoredProviderConnection | null> {
    const [connectionSnapshot, secretSnapshot] = await Promise.all([
      admin.firestore().collection(CONNECTIONS_COLLECTION).doc(connectionId).get(),
      admin.firestore().collection(SECRETS_COLLECTION).doc(connectionId).get(),
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
      baseUrl: typeof data.baseUrl === 'string' ? data.baseUrl.trim() : undefined,
      imageGenerationUrl:
        typeof data.imageGenerationUrl === 'string' ? data.imageGenerationUrl.trim() : undefined,
    };
  }

  static async getEncryptedSecret(
    connectionId: string
  ): Promise<IEncryptedSecretRecord | null> {
    const snap = await admin
      .firestore()
      .collection(SECRETS_COLLECTION)
      .doc(connectionId)
      .get();

    if (!snap.exists) {
      return null;
    }

    return snap.data() as IEncryptedSecretRecord;
  }

  static async isConfigured(connectionId: string): Promise<boolean> {
    const secret = await this.getEncryptedSecret(connectionId);
    return secret !== null;
  }
}
