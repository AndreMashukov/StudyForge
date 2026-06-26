import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import type { ILlmModalityRoute, ILlmSetup, IUserGroup, LlmModality } from '@shared-types';
import { LlmSettingsRepository } from './llm-settings-repository';
import { decryptLlmSecret, isLlmEncryptionAvailable } from './llm-secret-resolver';
import { parseMiniMaxConnection } from './minimax-provider-client';
import {
  createLlmSetupNotFoundError,
  createProviderNotConfiguredError,
  createUserGroupNotAssignedError,
  createUserGroupNotFoundError,
} from './llm-routing-error';
import type { ResolvedRoute } from './types';

const LLM_SETUPS_COLLECTION = 'llmSetups';
const USER_GROUPS_COLLECTION = 'userGroups';
const USERS_COLLECTION = 'users';

const OPENROUTER_CONNECTION_ID = 'openrouter-primary';
const MINIMAX_CONNECTION_ID = 'minimax-primary';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export interface IUserRoutingContext {
  userId: string;
  userGroupId: string;
  group: IUserGroup;
  setup: ILlmSetup;
}

export interface SetupRouteResolution {
  route: ResolvedRoute;
  providerApiKey?: string;
  userGroupId: string;
  llmSetupId: string;
  modality: LlmModality;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseModalityRoute(value: unknown, modality: LlmModality): ILlmModalityRoute | null {
  if (!isRecord(value)) {
    return null;
  }

  const providerType = value.providerType;
  const model = value.model;

  if (
    (providerType !== 'gemini' && providerType !== 'openrouter' && providerType !== 'minimax') ||
    typeof model !== 'string' ||
    !model.trim()
  ) {
    return null;
  }

  return {
    providerType,
    model: model.trim(),
  };
}

function parseLlmSetup(id: string, data: FirebaseFirestore.DocumentData): ILlmSetup | null {
  if (!isRecord(data.routes)) {
    return null;
  }

  const text = parseModalityRoute(data.routes.text, 'text');
  const vision = parseModalityRoute(data.routes.vision, 'vision');
  const image = parseModalityRoute(data.routes.image, 'image');

  if (!text || !vision || !image) {
    return null;
  }

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name) {
    return null;
  }

  return {
    id,
    name,
    description: typeof data.description === 'string' ? data.description : undefined,
    routes: { text, vision, image },
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
  };
}

function parseUserGroup(id: string, data: FirebaseFirestore.DocumentData): IUserGroup | null {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const llmSetupId = typeof data.llmSetupId === 'string' ? data.llmSetupId.trim() : '';

  if (!name || !llmSetupId) {
    return null;
  }

  return {
    id,
    name,
    llmSetupId,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
  };
}

export class LlmSetupRepository {
  static async resolveUserRoutingContext(userId: string): Promise<IUserRoutingContext> {
    const userSnapshot = await admin.firestore().collection(USERS_COLLECTION).doc(userId).get();
    const userData = userSnapshot.data();
    const userGroupId =
      typeof userData?.userGroupId === 'string' ? userData.userGroupId.trim() : '';

    if (!userGroupId) {
      throw createUserGroupNotAssignedError(userId);
    }

    const groupSnapshot = await admin
      .firestore()
      .collection(USER_GROUPS_COLLECTION)
      .doc(userGroupId)
      .get();

    if (!groupSnapshot.exists) {
      throw createUserGroupNotFoundError(userId, userGroupId);
    }

    const group = parseUserGroup(groupSnapshot.id, groupSnapshot.data() ?? {});
    if (!group) {
      throw createUserGroupNotFoundError(userId, userGroupId);
    }

    const setupSnapshot = await admin
      .firestore()
      .collection(LLM_SETUPS_COLLECTION)
      .doc(group.llmSetupId)
      .get();

    if (!setupSnapshot.exists) {
      throw createLlmSetupNotFoundError(userId, userGroupId, group.llmSetupId);
    }

    const setup = parseLlmSetup(setupSnapshot.id, setupSnapshot.data() ?? {});
    if (!setup) {
      throw createLlmSetupNotFoundError(userId, userGroupId, group.llmSetupId);
    }

    return {
      userId,
      userGroupId,
      group,
      setup,
    };
  }

  static async resolveModalityRoute(
    userId: string,
    modality: LlmModality
  ): Promise<SetupRouteResolution> {
    const context = await this.resolveUserRoutingContext(userId);
    const modalityRoute = context.setup.routes[modality];

    functions.logger.info('Resolving LLM setup route', {
      userId,
      userGroupId: context.userGroupId,
      llmSetupId: context.setup.id,
      modality,
      providerType: modalityRoute.providerType,
      model: modalityRoute.model,
    });

    const resolution = await this.resolveProviderRoute(
      modalityRoute,
      context,
      modality
    );

    return {
      ...resolution,
      userGroupId: context.userGroupId,
      llmSetupId: context.setup.id,
      modality,
    };
  }

  private static async resolveProviderRoute(
    modalityRoute: ILlmModalityRoute,
    context: IUserRoutingContext,
    modality: LlmModality
  ): Promise<{ route: ResolvedRoute; providerApiKey?: string }> {
    const { providerType, model } = modalityRoute;
    const { userId, userGroupId, setup } = context;

    if (providerType === 'gemini') {
      return {
        route: {
          connectionId: 'gemini-primary',
          providerType: 'gemini',
          model,
          fallbackUsed: false,
        },
      };
    }

    if (providerType === 'openrouter') {
      const connection = await LlmSettingsRepository.getOpenRouterConnection();
      if (!connection || !connection.enabled || !connection.apiKeyConfigured) {
        throw createProviderNotConfiguredError(
          userId,
          userGroupId,
          setup.id,
          modality,
          providerType
        );
      }

      if (!isLlmEncryptionAvailable()) {
        throw createProviderNotConfiguredError(
          userId,
          userGroupId,
          setup.id,
          modality,
          providerType
        );
      }

      const encryptedSecret = await LlmSettingsRepository.getOpenRouterEncryptedSecret();
      if (!encryptedSecret) {
        throw createProviderNotConfiguredError(
          userId,
          userGroupId,
          setup.id,
          modality,
          providerType
        );
      }

      const apiKey = decryptLlmSecret(encryptedSecret);

      return {
        route: {
          connectionId: OPENROUTER_CONNECTION_ID,
          providerType: 'openrouter',
          model,
          fallbackUsed: false,
          openRouterBaseUrl: connection.baseUrl || OPENROUTER_BASE_URL,
        },
        providerApiKey: apiKey,
      };
    }

    if (providerType === 'minimax') {
      const connection = await LlmSettingsRepository.getMiniMaxConnection();
      const parsed = parseMiniMaxConnection(connection);

      if (!connection || !connection.enabled || !connection.apiKeyConfigured) {
        throw createProviderNotConfiguredError(
          userId,
          userGroupId,
          setup.id,
          modality,
          providerType
        );
      }

      if (!isLlmEncryptionAvailable()) {
        throw createProviderNotConfiguredError(
          userId,
          userGroupId,
          setup.id,
          modality,
          providerType
        );
      }

      const encryptedSecret = await LlmSettingsRepository.getMiniMaxEncryptedSecret();
      if (!encryptedSecret) {
        throw createProviderNotConfiguredError(
          userId,
          userGroupId,
          setup.id,
          modality,
          providerType
        );
      }

      const apiKey = decryptLlmSecret(encryptedSecret);

      return {
        route: {
          connectionId: MINIMAX_CONNECTION_ID,
          providerType: 'minimax',
          model,
          fallbackUsed: false,
          miniMaxBaseUrl: parsed.baseUrl,
          miniMaxImageUrl: parsed.imageGenerationUrl,
        },
        providerApiKey: apiKey,
      };
    }

    throw createProviderNotConfiguredError(
      userId,
      userGroupId,
      setup.id,
      modality,
      String(providerType)
    );
  }
}
