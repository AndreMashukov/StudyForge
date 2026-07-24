import * as functions from 'firebase-functions';
import type { LlmModality } from '@shared-types';
import { decryptLlmSecret, isLlmEncryptionAvailable } from './llm-secret-resolver';
import { createProviderNotConfiguredError } from './llm-routing-error';
import { ProviderConnectionRepository } from './provider-connection-repository';
import type { ResolvedRoute } from './types';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MINIMAX_BASE_URL = 'https://api.minimax.io/v1';
const MINIMAX_IMAGE_URL = 'https://api.minimax.io/v1/image_generation';
const TOGETHER_BASE_URL = 'https://api.together.ai/v1';

export interface IProviderConnectionResolveParams {
  connectionId: string;
  model: string;
  modality: LlmModality;
  userId: string;
  userGroupId: string;
  llmSetupId: string;
}

export interface IProviderConnectionResolution {
  route: ResolvedRoute;
  providerApiKey: string;
}

export async function resolveProviderConnectionRoute(
  params: IProviderConnectionResolveParams
): Promise<IProviderConnectionResolution> {
  const { connectionId, model, modality, userId, userGroupId, llmSetupId } = params;

  const connection = await ProviderConnectionRepository.getById(connectionId);
  if (!connection) {
    functions.logger.error('Provider connection not found for setup route', {
      userId,
      userGroupId,
      llmSetupId,
      modality,
      connectionId,
    });
    throw createProviderNotConfiguredError(
      userId,
      userGroupId,
      llmSetupId,
      modality,
      connectionId
    );
  }

  if (!connection.supportedModalities.includes(modality)) {
    functions.logger.error('Provider connection does not support modality', {
      userId,
      userGroupId,
      llmSetupId,
      modality,
      connectionId,
      providerKind: connection.providerKind,
      supportedModalities: connection.supportedModalities,
    });
    throw createProviderNotConfiguredError(
      userId,
      userGroupId,
      llmSetupId,
      modality,
      connection.providerKind
    );
  }

  if (!connection.apiKeyConfigured || !(await ProviderConnectionRepository.isConfigured(connectionId))) {
    functions.logger.error('Provider connection credentials missing', {
      userId,
      userGroupId,
      llmSetupId,
      modality,
      connectionId,
      providerKind: connection.providerKind,
    });
    throw createProviderNotConfiguredError(
      userId,
      userGroupId,
      llmSetupId,
      modality,
      connection.providerKind
    );
  }

  if (!isLlmEncryptionAvailable()) {
    throw createProviderNotConfiguredError(
      userId,
      userGroupId,
      llmSetupId,
      modality,
      connection.providerKind
    );
  }

  const encryptedSecret = await ProviderConnectionRepository.getEncryptedSecret(connectionId);
  if (!encryptedSecret) {
    throw createProviderNotConfiguredError(
      userId,
      userGroupId,
      llmSetupId,
      modality,
      connection.providerKind
    );
  }

  const providerApiKey = decryptLlmSecret(encryptedSecret);

  if (connection.providerKind === 'gemini') {
    return {
      route: {
        connectionId,
        providerType: 'gemini',
        model,
        fallbackUsed: false,
      },
      providerApiKey,
    };
  }

  if (connection.providerKind === 'openrouter') {
    return {
      route: {
        connectionId,
        providerType: 'openrouter',
        model,
        fallbackUsed: false,
        openRouterBaseUrl: connection.baseUrl || OPENROUTER_BASE_URL,
      },
      providerApiKey,
    };
  }

  if (connection.providerKind === 'minimax') {
    return {
      route: {
        connectionId,
        providerType: 'minimax',
        model,
        fallbackUsed: false,
        miniMaxBaseUrl: connection.baseUrl || MINIMAX_BASE_URL,
        miniMaxImageUrl: connection.imageGenerationUrl || MINIMAX_IMAGE_URL,
      },
      providerApiKey,
    };
  }

  if (connection.providerKind === 'together') {
    return {
      route: {
        connectionId,
        providerType: 'together',
        model,
        fallbackUsed: false,
        togetherBaseUrl: connection.baseUrl || TOGETHER_BASE_URL,
      },
      providerApiKey,
    };
  }

  throw createProviderNotConfiguredError(
    userId,
    userGroupId,
    llmSetupId,
    modality,
    connection.providerKind
  );
}
