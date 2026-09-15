#!/usr/bin/env node
/**
 * Seed LLM routing for local emulator E2E — MiniMax M3 + OpenRouter embeddings.
 *
 * Creates:
 *   - llmProviderConnections/minimax-primary (+ encrypted API key)
 *   - llmProviderConnections/openrouter-primary (+ encrypted API key)
 *   - llmSetups/e2e-minimax-m3
 *       text/vision/image → MiniMax-M3 / image-01
 *       agentKnowledgeEmbedding → OpenRouter intfloat/multilingual-e5-large (1024-d)
 *   - userGroups/e2e-default-group
 *   - users/{uid}.userGroupId assignment
 *
 * Usage:
 *   MINIMAX_API_KEY=... OPENROUTER_API_KEY=... LLM_SETTINGS_ENCRYPTION_KEY=... \
 *     npx tsx scripts/seed-setup/seed-llm-setup.ts
 *
 * Env (also loaded from .env.local, functions/.env.local, functions/.env):
 *   MINIMAX_API_KEY — required unless already seeded in Firestore, or production copy succeeds
 *   OPENROUTER_API_KEY — required for OpenRouter embeddings unless already seeded
 *   LLM_SETTINGS_ENCRYPTION_KEY — required to encrypt provider secrets
 *   GCLOUD_PROJECT — defaults to study-forge-202604
 */
import * as admin from 'firebase-admin';
import {
  createCipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import * as path from 'path';
import { config } from 'dotenv';
import {
  ALL_GENERATION_KINDS,
  GENERATION_KIND_METADATA,
} from '../../libs/shared-types/src/generation-kind-metadata';
import {
  PRIMARY_MINIMAX_CONNECTION_ID,
  PRIMARY_OPENROUTER_CONNECTION_ID,
  USAGE_LIMITS_PROFILE_PRESETS,
  createDefaultFeaturePolicies,
  type IGenerationRoutes,
  type IProviderAvailableModel,
} from '../../libs/shared-types/src/index';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), 'functions/.env.local') });
config({ path: path.join(process.cwd(), 'functions/.env') });
config({ path: path.join(process.cwd(), 'functions/.secret.local') });

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? 'study-forge-202604';
const TARGET_UID = '4ZBsEPIUJ4jrlylcXkg7t3sFdPZv';
const SETUP_ID = 'e2e-minimax-m3';
const GROUP_ID = 'e2e-default-group';

const TEXT_MODEL = 'MiniMax-M3';
const VISION_MODEL = 'MiniMax-M3';
const IMAGE_MODEL = 'image-01';
const EMBEDDING_MODEL = 'intfloat/multilingual-e5-large';
const MINIMAX_BASE_URL = 'https://api.minimax.io/v1';
const MINIMAX_IMAGE_URL = 'https://api.minimax.io/v1/image_generation';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

const CONNECTIONS_COLLECTION = 'llmProviderConnections';
const SECRETS_COLLECTION = 'llmProviderConnectionSecrets';
const LLM_SETUPS_COLLECTION = 'llmSetups';
const USER_GROUPS_COLLECTION = 'userGroups';
const USAGE_LIMITS_SETUPS_COLLECTION = 'usageLimitsSetups';
const STANDARD_USAGE_SETUP_ID = 'e2e-standard-usage';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const MINIMAX_CATALOG: IProviderAvailableModel[] = [
  {
    id: TEXT_MODEL,
    label: 'MiniMax M3',
    supportedModalities: ['text', 'vision'],
  },
  {
    id: IMAGE_MODEL,
    label: 'MiniMax Image 01',
    supportedModalities: ['image'],
  },
];

const OPENROUTER_CATALOG: IProviderAvailableModel[] = [
  {
    id: EMBEDDING_MODEL,
    label: 'Multilingual E5 Large (1024-d)',
    supportedModalities: ['embedding'],
  },
];

function getEncryptionKey(): Buffer {
  const secret = process.env.LLM_SETTINGS_ENCRYPTION_KEY?.trim();
  if (!secret) {
    throw new Error(
      'LLM_SETTINGS_ENCRYPTION_KEY is required. Copy from functions/.env.example or functions/.secret.local.'
    );
  }
  return createHash('sha256').update(secret).digest();
}

function encryptSecret(value: string): Record<string, unknown> {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Secret value cannot be empty.');
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: ENCRYPTION_ALGORITHM,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

function buildGenerationRoutes(): IGenerationRoutes {
  const routes = {} as IGenerationRoutes;

  for (const kind of ALL_GENERATION_KINDS) {
    const metadata = GENERATION_KIND_METADATA[kind];

    if (metadata.requiredModality === 'embedding') {
      routes[kind] = {
        connectionId: PRIMARY_OPENROUTER_CONNECTION_ID,
        model: EMBEDDING_MODEL,
        modality: 'embedding',
        workflow: metadata.defaultWorkflow,
      };
      continue;
    }

    const model =
      metadata.requiredModality === 'text'
        ? TEXT_MODEL
        : metadata.requiredModality === 'vision'
          ? VISION_MODEL
          : IMAGE_MODEL;

    routes[kind] = {
      connectionId: PRIMARY_MINIMAX_CONNECTION_ID,
      model,
      modality: metadata.requiredModality,
      workflow: metadata.defaultWorkflow,
    };
  }

  return routes;
}

function resolveOpenRouterApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY?.trim() || undefined;
}

async function ensureProviderSecretFromProduction(input: {
  db: admin.firestore.Firestore;
  connectionId: string;
  appName: string;
  label: string;
}): Promise<boolean> {
  const secretRef = input.db.collection(SECRETS_COLLECTION).doc(input.connectionId);
  if ((await secretRef.get()).exists) {
    return true;
  }

  if (!process.env.LLM_SETTINGS_ENCRYPTION_KEY?.trim()) {
    return false;
  }

  console.log(`   ${input.label} secret missing locally — trying production copy …`);
  const savedEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIRESTORE_EMULATOR_HOST;

  const existing = admin.apps.find((app) => app?.name === input.appName);
  if (existing) {
    await existing.delete();
  }

  try {
    const prodApp = admin.initializeApp({ projectId: PROJECT_ID }, input.appName);
    const prodDb = prodApp.firestore();
    const [connectionSnap, secretSnap] = await Promise.all([
      prodDb.collection(CONNECTIONS_COLLECTION).doc(input.connectionId).get(),
      prodDb.collection(SECRETS_COLLECTION).doc(input.connectionId).get(),
    ]);

    if (!connectionSnap.exists || !secretSnap.exists) {
      console.warn(
        `   ⚠️ Production ${input.label} connection/secret not found — skip copy`,
      );
      return false;
    }

    if (savedEmulatorHost) {
      process.env.FIRESTORE_EMULATOR_HOST = savedEmulatorHost;
    }

    const now = new Date().toISOString();
    await input.db.collection(CONNECTIONS_COLLECTION).doc(input.connectionId).set(
      {
        ...connectionSnap.data(),
        updatedAt: now,
        updatedBy: 'seed-llm-setup',
      },
      { merge: true },
    );
    await secretRef.set({
      ...secretSnap.data(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'seed-llm-setup',
    });
    console.log(`   ✅ Copied ${input.label} connection + secret from production`);
    return true;
  } catch (error) {
    console.warn(
      `   ⚠️ Production ${input.label} copy failed:`,
      error instanceof Error ? error.message : String(error),
    );
    return false;
  } finally {
    const prodApp = admin.apps.find((app) => app?.name === input.appName);
    if (prodApp) {
      await prodApp.delete().catch(() => undefined);
    }
    if (savedEmulatorHost) {
      process.env.FIRESTORE_EMULATOR_HOST = savedEmulatorHost;
    }
  }
}

async function ensureProviderSecret(input: {
  db: admin.firestore.Firestore;
  connectionId: string;
  apiKey: string | undefined;
  label: string;
}): Promise<void> {
  const secretRef = input.db.collection(SECRETS_COLLECTION).doc(input.connectionId);
  const existingSecret = await secretRef.get();
  if (existingSecret.exists) {
    console.log(`\n[LLM] ${input.label} secret already exists — skip`);
    return;
  }

  if (!input.apiKey) {
    throw new Error(
      `${input.label} API key is required to seed ${input.connectionId}. Set it in .env.local or functions/.env.local.`
    );
  }

  console.log(`\n[LLM] Encrypting ${input.label} API key …`);
  const encrypted = encryptSecret(input.apiKey);
  await secretRef.set({
    ...encrypted,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: 'seed-llm-setup',
  });
  await input.db.collection(CONNECTIONS_COLLECTION).doc(input.connectionId).set(
    { apiKeyConfigured: true },
    { merge: true },
  );
  console.log(`   ✅ ${input.connectionId} secret stored`);
}

export async function seedLlmSetup(options?: { userId?: string }): Promise<void> {
  process.env.FIREBASE_AUTH_EMULATOR_HOST =
    process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
  process.env.FIRESTORE_EMULATOR_HOST =
    process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';

  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }

  const db = admin.firestore();
  const userId = options?.userId ?? TARGET_UID;
  const now = new Date().toISOString();
  const minimaxApiKey = process.env.MINIMAX_API_KEY?.trim();
  const openRouterApiKey = resolveOpenRouterApiKey();

  console.log('\n[LLM] MiniMax provider connection …');
  const connectionRef = db.collection(CONNECTIONS_COLLECTION).doc(PRIMARY_MINIMAX_CONNECTION_ID);
  const secretRef = db.collection(SECRETS_COLLECTION).doc(PRIMARY_MINIMAX_CONNECTION_ID);
  let existingSecret = await secretRef.get();

  if (!existingSecret.exists && !minimaxApiKey) {
    await ensureProviderSecretFromProduction({
      db,
      connectionId: PRIMARY_MINIMAX_CONNECTION_ID,
      appName: 'production-minimax-seed',
      label: 'MiniMax',
    });
    existingSecret = await secretRef.get();
  }

  await connectionRef.set(
    {
      providerKind: 'minimax',
      label: 'Primary MiniMax',
      credentialMode: 'encrypted-firestore',
      supportedModalities: ['text', 'vision', 'image'],
      baseUrl: MINIMAX_BASE_URL,
      imageGenerationUrl: MINIMAX_IMAGE_URL,
      defaultModel: TEXT_MODEL,
      defaultVisionModel: VISION_MODEL,
      defaultImageModel: IMAGE_MODEL,
      availableModels: MINIMAX_CATALOG,
      modelsSyncedAt: now,
      modelsSyncSource: 'provider-save',
      apiKeyConfigured: existingSecret.exists || Boolean(minimaxApiKey),
      updatedAt: now,
      updatedBy: 'seed-llm-setup',
    },
    { merge: true },
  );
  console.log(`   ✅ Connection ${PRIMARY_MINIMAX_CONNECTION_ID}`);

  if (!existingSecret.exists) {
    await ensureProviderSecret({
      db,
      connectionId: PRIMARY_MINIMAX_CONNECTION_ID,
      apiKey: minimaxApiKey,
      label: 'MiniMax',
    });
  } else {
    console.log('\n[LLM] MiniMax secret already exists — skip');
  }

  console.log('\n[LLM] OpenRouter provider connection (embeddings) …');
  const openRouterConnectionRef = db
    .collection(CONNECTIONS_COLLECTION)
    .doc(PRIMARY_OPENROUTER_CONNECTION_ID);
  const openRouterSecretRef = db
    .collection(SECRETS_COLLECTION)
    .doc(PRIMARY_OPENROUTER_CONNECTION_ID);
  let existingOpenRouterSecret = await openRouterSecretRef.get();

  if (!existingOpenRouterSecret.exists && !openRouterApiKey) {
    await ensureProviderSecretFromProduction({
      db,
      connectionId: PRIMARY_OPENROUTER_CONNECTION_ID,
      appName: 'production-openrouter-seed',
      label: 'OpenRouter',
    });
    existingOpenRouterSecret = await openRouterSecretRef.get();
  }

  await openRouterConnectionRef.set(
    {
      providerKind: 'openrouter',
      label: 'Primary OpenRouter',
      credentialMode: 'encrypted-firestore',
      supportedModalities: ['text', 'vision', 'image', 'embedding'],
      baseUrl: OPENROUTER_BASE_URL,
      defaultEmbeddingModel: EMBEDDING_MODEL,
      availableModels: OPENROUTER_CATALOG,
      modelsSyncedAt: now,
      modelsSyncSource: 'provider-save',
      apiKeyConfigured:
        existingOpenRouterSecret.exists || Boolean(openRouterApiKey),
      updatedAt: now,
      updatedBy: 'seed-llm-setup',
    },
    { merge: true },
  );
  console.log(`   ✅ Connection ${PRIMARY_OPENROUTER_CONNECTION_ID}`);

  await ensureProviderSecret({
    db,
    connectionId: PRIMARY_OPENROUTER_CONNECTION_ID,
    apiKey: openRouterApiKey,
    label: 'OpenRouter',
  });

  console.log('\n[LLM] LLM setup (MiniMax M3 + OpenRouter e5 embeddings) …');
  const generationRoutes = buildGenerationRoutes();
  await db.collection(LLM_SETUPS_COLLECTION).doc(SETUP_ID).set({
    name: 'E2E MiniMax M3 + OpenRouter E5',
    description:
      'Local emulator setup — generation via MiniMax-M3; agentKnowledgeEmbedding via OpenRouter intfloat/multilingual-e5-large (1024-d)',
    generationRoutes,
    updatedAt: now,
    updatedBy: 'seed-llm-setup',
  });
  console.log(`   ✅ LLM setup ${SETUP_ID}`);
  console.log(
    `   ✅ agentKnowledgeEmbedding → ${EMBEDDING_MODEL} on ${PRIMARY_OPENROUTER_CONNECTION_ID}`,
  );

  console.log('\n[LLM] Usage limits setup …');
  const standardPreset =
    USAGE_LIMITS_PROFILE_PRESETS.find((preset) => preset.id === 'standard') ??
    USAGE_LIMITS_PROFILE_PRESETS[1];
  await db.collection(USAGE_LIMITS_SETUPS_COLLECTION).doc(STANDARD_USAGE_SETUP_ID).set({
    name: standardPreset.name,
    description: standardPreset.description,
    monthlyCreditAllowance: standardPreset.monthlyCreditAllowance,
    featurePolicies: createDefaultFeaturePolicies({ disabledKinds: standardPreset.disabledKinds }),
    updatedAt: now,
    updatedBy: 'seed-llm-setup',
  });
  console.log(`   ✅ Usage limits setup ${STANDARD_USAGE_SETUP_ID}`);

  console.log('\n[LLM] User group …');
  await db.collection(USER_GROUPS_COLLECTION).doc(GROUP_ID).set({
    name: 'E2E Default Group',
    llmSetupId: SETUP_ID,
    usageLimitsSetupId: STANDARD_USAGE_SETUP_ID,
    updatedAt: now,
    updatedBy: 'seed-llm-setup',
  });
  console.log(`   ✅ User group ${GROUP_ID} → ${SETUP_ID} / ${STANDARD_USAGE_SETUP_ID}`);

  console.log('\n[LLM] Assign test user to group …');
  await db.collection('users').doc(userId).set(
    { userGroupId: GROUP_ID },
    { merge: true },
  );
  console.log(`   ✅ users/${userId}.userGroupId = ${GROUP_ID}`);

  console.log(
    '\n✅ LLM setup seed complete (MiniMax-M3 + OpenRouter multilingual-e5-large).',
  );
}

async function main(): Promise<void> {
  await seedLlmSetup();
  console.log('   Restart the Functions emulator if it was running before seeding secrets.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('\n❌ LLM setup seed failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
