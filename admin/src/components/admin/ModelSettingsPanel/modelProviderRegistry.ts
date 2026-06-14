export type ModelProviderFieldKind =
  | 'readonlyText'
  | 'text'
  | 'url'
  | 'modelId'
  | 'secret';

export interface IModelProviderFieldDefinition {
  key: string;
  label: string;
  kind: ModelProviderFieldKind;
  showInOverview?: boolean;
  helpText?: string;
  placeholder?: string;
}

export interface IModelProviderDefinition {
  label: string;
  description: string;
  credentialMode: 'deployment-secret' | 'encrypted-firestore';
  isEditable: boolean;
  fields: readonly IModelProviderFieldDefinition[];
  staticBadges?: readonly string[];
}

export const modelProviderRegistry = {
  gemini: {
    label: 'Gemini',
    description:
      'Gemini uses the existing deployment secret and is not editable from the admin app. When Gemini is active, text, vision, and image generation use the server-managed key.',
    credentialMode: 'deployment-secret',
    isEditable: false,
    staticBadges: ['Server managed'],
    fields: [
      {
        key: 'credentialSource',
        label: 'Credential source',
        kind: 'readonlyText',
        showInOverview: true,
      },
      {
        key: 'textModel',
        label: 'Default model',
        kind: 'readonlyText',
        showInOverview: true,
      },
    ],
  },
  openrouter: {
    label: 'OpenRouter',
    description:
      'Configure OpenRouter models for text, vision, and slide image generation. Saved settings are preserved when another provider is active.',
    credentialMode: 'encrypted-firestore',
    isEditable: true,
    fields: [
      {
        key: 'baseUrl',
        label: 'Base URL',
        kind: 'url',
        showInOverview: true,
        placeholder: 'https://openrouter.ai/api/v1',
      },
      {
        key: 'textModel',
        label: 'Default text model',
        kind: 'modelId',
        showInOverview: true,
        placeholder: 'anthropic/claude-sonnet-4.6',
        helpText:
          'Used for quiz, flashcards, documents, chat, and other text generation.',
      },
      {
        key: 'visionModel',
        label: 'Default vision model',
        kind: 'modelId',
        showInOverview: true,
        placeholder: 'google/gemini-2.5-flash',
        helpText:
          'Used for screenshot and image input to text. Leave empty to use Gemini for screenshots.',
      },
      {
        key: 'imageModel',
        label: 'Default image model',
        kind: 'modelId',
        showInOverview: true,
        placeholder: 'google/gemini-3.1-flash-image-preview',
        helpText:
          'Used for slide deck image generation (text to image).',
      },
      {
        key: 'apiKey',
        label: 'API key',
        kind: 'secret',
        helpText: 'The key is encrypted server-side and never returned after save.',
      },
    ],
  },
} as const satisfies Record<string, IModelProviderDefinition>;

export type ModelProviderType = keyof typeof modelProviderRegistry;

export const modelProviderTypes = Object.keys(
  modelProviderRegistry
) as ModelProviderType[];

export function isModelProviderType(value: string): value is ModelProviderType {
  return Object.hasOwn(modelProviderRegistry, value);
}

export function getModelProviderDefinition(
  providerType: ModelProviderType
): IModelProviderDefinition {
  return modelProviderRegistry[providerType];
}
