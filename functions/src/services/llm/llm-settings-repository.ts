import * as admin from 'firebase-admin';
import type {
  IOpenRouterProviderConnection,
  IEncryptedSecretRecord,
  IMiniMaxProviderConnection,
} from '@shared-types';

const OPENROUTER_CONNECTION_ID = 'openrouter-primary';
const MINIMAX_CONNECTION_ID = 'minimax-primary';
const CONNECTIONS_COLLECTION = 'llmProviderConnections';
const SECRETS_COLLECTION = 'llmProviderConnectionSecrets';
const ACTIVE_PROVIDER_COLLECTION = 'llmSettings';
const ACTIVE_PROVIDER_DOC_ID = 'activeProvider';

export type ActiveLlmProviderId = 'gemini' | 'openrouter' | 'minimax';

function isActiveProviderId(value: unknown): value is ActiveLlmProviderId {
  return value === 'gemini' || value === 'openrouter' || value === 'minimax';
}

export class LlmSettingsRepository {
  static async getActiveProviderId(): Promise<ActiveLlmProviderId> {
    const activeSnapshot = await admin
      .firestore()
      .collection(ACTIVE_PROVIDER_COLLECTION)
      .doc(ACTIVE_PROVIDER_DOC_ID)
      .get();

    const activeProviderId = activeSnapshot.data()?.activeProviderId;
    if (isActiveProviderId(activeProviderId)) {
      return activeProviderId;
    }

    return 'gemini';
  }

  static async getOpenRouterConnection(): Promise<IOpenRouterProviderConnection | null> {
    const snap = await admin
      .firestore()
      .collection(CONNECTIONS_COLLECTION)
      .doc(OPENROUTER_CONNECTION_ID)
      .get();

    if (!snap.exists) return null;
    return snap.data() as IOpenRouterProviderConnection;
  }

  static async getMiniMaxConnection(): Promise<IMiniMaxProviderConnection | null> {
    const snap = await admin
      .firestore()
      .collection(CONNECTIONS_COLLECTION)
      .doc(MINIMAX_CONNECTION_ID)
      .get();

    if (!snap.exists) return null;
    return snap.data() as IMiniMaxProviderConnection;
  }

  static async getOpenRouterEncryptedSecret(): Promise<IEncryptedSecretRecord | null> {
    const snap = await admin
      .firestore()
      .collection(SECRETS_COLLECTION)
      .doc(OPENROUTER_CONNECTION_ID)
      .get();

    if (!snap.exists) return null;
    return snap.data() as IEncryptedSecretRecord;
  }

  /** Credentials are usable when an encrypted secret exists (setup-driven routing). */
  static async isOpenRouterConfigured(): Promise<boolean> {
    const secret = await this.getOpenRouterEncryptedSecret();
    return secret !== null;
  }

  static async getMiniMaxEncryptedSecret(): Promise<IEncryptedSecretRecord | null> {
    const snap = await admin
      .firestore()
      .collection(SECRETS_COLLECTION)
      .doc(MINIMAX_CONNECTION_ID)
      .get();

    if (!snap.exists) return null;
    return snap.data() as IEncryptedSecretRecord;
  }

  /** Credentials are usable when an encrypted secret exists (setup-driven routing). */
  static async isMiniMaxConfigured(): Promise<boolean> {
    const secret = await this.getMiniMaxEncryptedSecret();
    return secret !== null;
  }
}
