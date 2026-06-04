import * as admin from 'firebase-admin';
import type {
  IOpenRouterProviderConnection,
  IEncryptedSecretRecord,
  IGeminiImageProviderConnection,
} from '@shared-types';

const OPENROUTER_CONNECTION_ID = 'openrouter-primary';
const GEMINI_IMAGE_CONNECTION_ID = 'gemini-image-primary';
const CONNECTIONS_COLLECTION = 'llmProviderConnections';
const SECRETS_COLLECTION = 'llmProviderConnectionSecrets';

export class LlmSettingsRepository {
  static async getOpenRouterConnection(): Promise<IOpenRouterProviderConnection | null> {
    const snap = await admin
      .firestore()
      .collection(CONNECTIONS_COLLECTION)
      .doc(OPENROUTER_CONNECTION_ID)
      .get();

    if (!snap.exists) return null;
    return snap.data() as IOpenRouterProviderConnection;
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

  static async getGeminiImageConnection(): Promise<IGeminiImageProviderConnection | null> {
    const snap = await admin
      .firestore()
      .collection(CONNECTIONS_COLLECTION)
      .doc(GEMINI_IMAGE_CONNECTION_ID)
      .get();

    if (!snap.exists) return null;
    return snap.data() as IGeminiImageProviderConnection;
  }
}
