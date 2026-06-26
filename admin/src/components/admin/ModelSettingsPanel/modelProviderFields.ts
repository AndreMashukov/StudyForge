import type {
  ActiveModelProviderType,
  IGeminiProviderConnection,
  IMiniMaxProviderConnection,
  IOpenRouterProviderConnection,
} from '@shared-types';
import {
  getModelProviderDefinition,
  modelProviderTypes,
  type ModelProviderType,
} from './modelProviderRegistry';

export interface IModelProviderOverviewItem {
  providerType: ModelProviderType;
  label: string;
  description: string;
  isActive: boolean;
  isEditable: boolean;
  canActivate: boolean;
  activationBlockedReason?: string;
  staticBadges: string[];
  statusBadges: string[];
  overviewFields: Array<{ label: string; value: string }>;
  lastValidatedAt?: string;
  lastValidationError?: string | null;
  updatedAt?: string;
  updatedBy?: string;
}

interface IBuildProviderOverviewParams {
  activeProviderId?: ActiveModelProviderType;
  geminiConnection: IGeminiProviderConnection;
  openRouterConnection: IOpenRouterProviderConnection;
  miniMaxConnection: IMiniMaxProviderConnection;
}

function getGeminiFieldValue(
  key: string,
  connection: IGeminiProviderConnection
): string {
  if (key === 'textModel') {
    return connection.defaultModel;
  }

  if (key === 'visionModel') {
    return connection.defaultVisionModel?.trim() || connection.defaultModel;
  }

  if (key === 'imageModel') {
    return connection.defaultImageModel ?? '—';
  }

  if (key === 'apiKey') {
    return connection.apiKeyConfigured ? 'Configured' : 'Missing';
  }

  return '—';
}

function getOpenRouterFieldValue(
  key: string,
  connection: IOpenRouterProviderConnection
): string {
  if (key === 'baseUrl') {
    return connection.baseUrl;
  }

  if (key === 'textModel') {
    return connection.defaultModel;
  }

  if (key === 'visionModel') {
    return connection.defaultVisionModel?.trim() || '—';
  }

  if (key === 'imageModel') {
    return connection.defaultImageModel ?? '—';
  }

  if (key === 'apiKey') {
    return connection.apiKeyConfigured ? 'Configured' : 'Missing';
  }

  return '—';
}

function getMiniMaxFieldValue(
  key: string,
  connection: IMiniMaxProviderConnection
): string {
  if (key === 'baseUrl') {
    return connection.baseUrl;
  }

  if (key === 'textModel') {
    return connection.defaultModel;
  }

  if (key === 'visionModel') {
    return connection.defaultVisionModel?.trim() || '—';
  }

  if (key === 'imageModel') {
    return connection.defaultImageModel ?? '—';
  }

  if (key === 'imageGenerationUrl') {
    return connection.imageGenerationUrl;
  }

  if (key === 'apiKey') {
    return connection.apiKeyConfigured ? 'Configured' : 'Missing';
  }

  return '—';
}

function getProviderFieldValue(
  providerType: ModelProviderType,
  key: string,
  params: IBuildProviderOverviewParams
): string {
  if (providerType === 'gemini') {
    return getGeminiFieldValue(key, params.geminiConnection);
  }

  if (providerType === 'minimax') {
    return getMiniMaxFieldValue(key, params.miniMaxConnection);
  }

  return getOpenRouterFieldValue(key, params.openRouterConnection);
}

function getEncryptedProviderStatusBadges(
  connection:
    | IGeminiProviderConnection
    | IOpenRouterProviderConnection
    | IMiniMaxProviderConnection
): string[] {
  return [
    connection.lastValidationStatus || 'unknown',
    connection.apiKeyConfigured ? 'API key configured' : 'API key missing',
  ];
}

function getActivationState(
  providerType: ModelProviderType,
  params: IBuildProviderOverviewParams
): Pick<
  IModelProviderOverviewItem,
  'canActivate' | 'activationBlockedReason'
> {
  if (providerType === 'gemini' && !params.geminiConnection.apiKeyConfigured) {
    return {
      canActivate: false,
      activationBlockedReason:
        'Configure a Gemini API key before activating this provider.',
    };
  }

  if (providerType === 'openrouter' && !params.openRouterConnection.apiKeyConfigured) {
    return {
      canActivate: false,
      activationBlockedReason:
        'Configure an OpenRouter API key before activating this provider.',
    };
  }

  if (providerType === 'minimax' && !params.miniMaxConnection.apiKeyConfigured) {
    return {
      canActivate: false,
      activationBlockedReason:
        'Configure a MiniMax API key before activating this provider.',
    };
  }

  return { canActivate: true };
}

function getConnectionForProvider(
  providerType: ModelProviderType,
  params: IBuildProviderOverviewParams
): IGeminiProviderConnection | IOpenRouterProviderConnection | IMiniMaxProviderConnection {
  if (providerType === 'openrouter') {
    return params.openRouterConnection;
  }

  if (providerType === 'minimax') {
    return params.miniMaxConnection;
  }

  return params.geminiConnection;
}

export function buildProviderOverviewItems(
  params: IBuildProviderOverviewParams
): IModelProviderOverviewItem[] {
  return modelProviderTypes.map((providerType) => {
    const definition = getModelProviderDefinition(providerType);
    const overviewFieldDefs = definition.fields.filter(
      (field) => field.showInOverview
    );
    const activationState = getActivationState(providerType, params);
    const connection = getConnectionForProvider(providerType, params);

    return {
      providerType,
      label: definition.label,
      description: definition.description,
      isActive: params.activeProviderId === providerType,
      isEditable: definition.isEditable,
      staticBadges: [...(definition.staticBadges ?? [])],
      statusBadges:
        providerType === 'gemini'
          ? getEncryptedProviderStatusBadges(params.geminiConnection)
          : providerType === 'openrouter'
            ? getEncryptedProviderStatusBadges(params.openRouterConnection)
            : providerType === 'minimax'
              ? getEncryptedProviderStatusBadges(params.miniMaxConnection)
              : [],
      overviewFields: overviewFieldDefs.map((field) => ({
        label: field.label,
        value: getProviderFieldValue(providerType, field.key, params),
      })),
      lastValidatedAt: connection.lastValidatedAt,
      lastValidationError: connection.lastValidationError,
      updatedAt: connection.updatedAt,
      updatedBy: connection.updatedBy,
      ...activationState,
    };
  });
}

export function getProviderDetailFieldValues(
  providerType: ModelProviderType,
  params: IBuildProviderOverviewParams
): Array<{ label: string; value: string; helpText?: string }> {
  const definition = getModelProviderDefinition(providerType);

  return definition.fields.map((field) => ({
    label: field.label,
    value: getProviderFieldValue(providerType, field.key, params),
    helpText: field.helpText,
  }));
}
