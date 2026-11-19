import { createCipheriv, createHash, randomBytes } from 'crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALL_GENERATION_KINDS,
  DEFAULT_PROMPT_DIAGRAM_DECISION_MODEL,
  GENERATION_KIND_METADATA,
  type GenerationKind,
} from '@shared-types';

const store = vi.hoisted(() => new Map<string, Record<string, unknown>>());

vi.mock('firebase-admin', () => ({
  firestore: () => ({
    collection: (collection: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data = store.get(`${collection}/${id}`);
          return { id, exists: data !== undefined, data: () => data };
        },
      }),
    }),
  }),
}));

vi.mock('firebase-functions', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { LlmSetupRepository } from './llm-setup-repository';

const ENCRYPTION_KEY = 'spec-encryption-key';
const USER_ID = 'user-1';

function encryptedSecret(value: string): Record<string, unknown> {
  const key = createHash('sha256').update(ENCRYPTION_KEY).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

/**
 * A setup document saved before `promptDiagramDecision` and `scratchPadQuestion`
 * existed, with a stray key from a removed kind — the shape production has.
 */
function legacyGenerationRoutes(): Record<string, unknown> {
  const routes: Record<string, unknown> = {};
  for (const kind of ALL_GENERATION_KINDS) {
    if (kind === 'promptDiagramDecision' || kind === 'scratchPadQuestion') {
      continue;
    }
    const metadata = GENERATION_KIND_METADATA[kind];
    routes[kind] = {
      connectionId:
        metadata.requiredModality === 'embedding' ? 'openrouter-primary' : 'together-primary',
      model: `${kind}-model`,
      modality: metadata.requiredModality,
      workflow: metadata.defaultWorkflow,
    };
  }
  routes.removedLegacyKind = {
    connectionId: 'together-primary',
    model: 'x',
    modality: 'text',
    workflow: 'direct',
  };
  return routes;
}

function seedStore(generationRoutes: Record<string, unknown>): void {
  store.clear();
  store.set(`users/${USER_ID}`, { userGroupId: 'group-1' });
  store.set('userGroups/group-1', {
    name: 'Free Users',
    llmSetupId: 'setup-1',
    usageLimitsSetupId: 'usage-1',
  });
  store.set('llmSetups/setup-1', { name: 'Legacy setup', generationRoutes });
  // Connections saved before the decision modality existed.
  store.set('llmProviderConnections/openrouter-primary', {
    providerKind: 'openrouter',
    label: 'Primary OpenRouter',
    apiKeyConfigured: true,
    supportedModalities: ['text', 'vision', 'image', 'embedding'],
    baseUrl: 'https://openrouter.ai/api/v1',
  });
  store.set('llmProviderConnections/together-primary', {
    providerKind: 'together',
    label: 'Primary Together',
    apiKeyConfigured: true,
    supportedModalities: ['text', 'vision', 'image', 'embedding'],
  });
  store.set('llmProviderConnectionSecrets/openrouter-primary', encryptedSecret('or-key'));
  store.set('llmProviderConnectionSecrets/together-primary', encryptedSecret('tg-key'));
}

describe('LlmSetupRepository with a legacy setup document', () => {
  const previousKey = process.env.LLM_SETTINGS_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.LLM_SETTINGS_ENCRYPTION_KEY = ENCRYPTION_KEY;
  });

  afterAll(() => {
    if (previousKey === undefined) {
      delete process.env.LLM_SETTINGS_ENCRYPTION_KEY;
    } else {
      process.env.LLM_SETTINGS_ENCRYPTION_KEY = previousKey;
    }
  });

  beforeEach(() => {
    seedStore(legacyGenerationRoutes());
  });

  it('still resolves every generation kind', async () => {
    const failures: string[] = [];
    for (const kind of ALL_GENERATION_KINDS) {
      try {
        await LlmSetupRepository.resolveGenerationRoute(USER_ID, kind);
      } catch (error) {
        failures.push(`${kind}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('backfills promptDiagramDecision to the default OpenRouter decision model', async () => {
    const resolution = await LlmSetupRepository.resolveGenerationRoute(
      USER_ID,
      'promptDiagramDecision',
    );

    expect(resolution.modality).toBe('decision');
    expect(resolution.workflow).toBe('direct');
    expect(resolution.providerApiKey).toBe('or-key');
    expect(resolution.route).toMatchObject({
      connectionId: 'openrouter-primary',
      providerType: 'openrouter',
      model: DEFAULT_PROMPT_DIAGRAM_DECISION_MODEL,
      openRouterBaseUrl: 'https://openrouter.ai/api/v1',
    });
  });

  it('uses the model an admin configured for promptDiagramDecision', async () => {
    seedStore({
      ...legacyGenerationRoutes(),
      promptDiagramDecision: {
        connectionId: 'openrouter-primary',
        model: 'google/gemini-decision-1',
        modality: 'decision',
        workflow: 'direct',
      },
    });

    const resolution = await LlmSetupRepository.resolveGenerationRoute(
      USER_ID,
      'promptDiagramDecision',
    );

    expect(resolution.route.model).toBe('google/gemini-decision-1');
  });

  it('rejects a decision route on a provider without decision models', async () => {
    seedStore({
      ...legacyGenerationRoutes(),
      promptDiagramDecision: {
        connectionId: 'together-primary',
        model: 'some/model',
        modality: 'decision',
        workflow: 'direct',
      },
    });

    await expect(
      LlmSetupRepository.resolveGenerationRoute(USER_ID, 'promptDiagramDecision'),
    ).rejects.toThrow();
  });

  it('leaves the other routes untouched', async () => {
    const kind: GenerationKind = 'quiz';
    const resolution = await LlmSetupRepository.resolveGenerationRoute(USER_ID, kind);

    expect(resolution.route).toMatchObject({
      connectionId: 'together-primary',
      providerType: 'together',
      model: 'quiz-model',
    });
  });
});
