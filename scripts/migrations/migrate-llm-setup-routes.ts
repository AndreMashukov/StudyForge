#!/usr/bin/env node
/**
 * One-time migration: LLM setup routes + provider connection documents.
 *
 * - Rewrites llmSetups.routes.* from legacy `{ providerType, model }` to `{ connectionId, model }`.
 * - Ensures primary provider connection docs exist with providerKind + supportedModalities.
 * - Optionally seeds gemini-primary encrypted secret from GEMINI_API_KEY when missing.
 *
 * Usage:
 *   GCLOUD_PROJECT=your-project npx tsx scripts/migrations/migrate-llm-setup-routes.ts --dry-run
 *   GCLOUD_PROJECT=your-project npx tsx scripts/migrations/migrate-llm-setup-routes.ts
 *
 * Env:
 *   GOOGLE_APPLICATION_CREDENTIALS or gcloud ADC
 *   LLM_SETTINGS_ENCRYPTION_KEY — required to seed Gemini secret from GEMINI_API_KEY
 *   GEMINI_API_KEY — optional source for gemini-primary secret when not in Firestore
 *   FIRESTORE_EMULATOR_HOST — optional for local emulator
 */
import * as admin from 'firebase-admin';
import {
  createCipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), 'functions/.env.local') });
config({ path: path.join(process.cwd(), 'functions/.env') });

const LLM_SETUPS_COLLECTION = 'llmSetups';
const CONNECTIONS_COLLECTION = 'llmProviderConnections';
const SECRETS_COLLECTION = 'llmProviderConnectionSecrets';

const PRIMARY_GEMINI_CONNECTION_ID = 'gemini-primary';
const PRIMARY_OPENROUTER_CONNECTION_ID = 'openrouter-primary';
const PRIMARY_MINIMAX_CONNECTION_ID = 'minimax-primary';
const PRIMARY_TOGETHER_CONNECTION_ID = 'together-primary';

const ALL_MODALITIES = ['text', 'vision', 'image'] as const;

const PROVIDER_TO_CONNECTION: Record<string, string> = {
  gemini: PRIMARY_GEMINI_CONNECTION_ID,
  openrouter: PRIMARY_OPENROUTER_CONNECTION_ID,
  minimax: PRIMARY_MINIMAX_CONNECTION_ID,
  together: PRIMARY_TOGETHER_CONNECTION_ID,
};

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

interface MigrationStats {
  setupsScanned: number;
  setupsUpdated: number;
  connectionsCreated: number;
  connectionsUpdated: number;
  geminiSecretSeeded: boolean;
}

function printHelp(): void {
  console.log(`
Migrate LLM setup routes to provider connection IDs

  yarn migrate:llm-setup-routes [--dry-run]

  Examples:
    yarn migrate:llm-setup-routes --dry-run
    GEMINI_API_KEY=... LLM_SETTINGS_ENCRYPTION_KEY=... yarn migrate:llm-setup-routes
`);
}

function parseArgs(): { dryRun: boolean; help: boolean } {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    return { dryRun: false, help: true };
  }
  return { dryRun: args.includes('--dry-run'), help: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getProjectId(): string {
  const projectId =
    process.env.GCLOUD_PROJECT ??
    process.env.GCP_PROJECT ??
    process.env.FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('Set GCLOUD_PROJECT (or GCP_PROJECT) before running migration.');
  }

  return projectId;
}

function getEncryptionKey(): Buffer | null {
  const secret = process.env.LLM_SETTINGS_ENCRYPTION_KEY;
  if (!secret) {
    return null;
  }
  return createHash('sha256').update(secret).digest();
}

function encryptSecret(value: string): Record<string, unknown> {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error('LLM_SETTINGS_ENCRYPTION_KEY is required to encrypt secrets.');
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Secret value cannot be empty.');
  }

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

function parseLegacyModalityRoute(value: unknown): { connectionId: string; model: string } | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.connectionId === 'string' && typeof value.model === 'string') {
    const connectionId = value.connectionId.trim();
    const model = value.model.trim();
    if (connectionId && model) {
      return { connectionId, model };
    }
  }

  const providerType =
    typeof value.providerType === 'string' ? value.providerType.trim() : '';
  const model = typeof value.model === 'string' ? value.model.trim() : '';

  if (!providerType || !model) {
    return null;
  }

  const connectionId = PROVIDER_TO_CONNECTION[providerType];
  if (!connectionId) {
    return null;
  }

  return { connectionId, model };
}

function buildPrimaryConnectionDoc(
  connectionId: string,
  providerKind: 'gemini' | 'openrouter' | 'minimax' | 'together',
  existing: Record<string, unknown> | undefined
): Record<string, unknown> | null {
  const next: Record<string, unknown> = {
    ...(existing ?? {}),
    providerKind,
    credentialMode: 'encrypted-firestore',
    supportedModalities: [...ALL_MODALITIES],
  };

  if (!existing?.label) {
    next.label =
      providerKind === 'gemini'
        ? 'Primary Gemini'
        : providerKind === 'openrouter'
          ? 'Primary OpenRouter'
          : providerKind === 'minimax'
            ? 'Primary MiniMax'
            : 'Primary Together';
  }

  const changed =
    existing?.providerKind !== providerKind ||
    existing?.credentialMode !== 'encrypted-firestore' ||
    JSON.stringify(existing?.supportedModalities ?? []) !== JSON.stringify([...ALL_MODALITIES]);

  return changed || !existing ? next : null;
}

async function migrateSetupRoutes(
  db: admin.firestore.Firestore,
  dryRun: boolean,
  stats: MigrationStats
): Promise<void> {
  const snapshot = await db.collection(LLM_SETUPS_COLLECTION).get();

  for (const doc of snapshot.docs) {
    stats.setupsScanned += 1;
    const data = doc.data();
    const routes = data.routes;

    if (!isRecord(routes)) {
      console.warn(`  skip ${doc.id}: missing routes`);
      continue;
    }

    const text = parseLegacyModalityRoute(routes.text);
    const vision = parseLegacyModalityRoute(routes.vision);
    const image = parseLegacyModalityRoute(routes.image);

    if (!text || !vision || !image) {
      console.warn(`  skip ${doc.id}: invalid routes`);
      continue;
    }

    const alreadyMigrated =
      isRecord(routes.text) &&
      typeof routes.text.connectionId === 'string' &&
      isRecord(routes.vision) &&
      typeof routes.vision.connectionId === 'string' &&
      isRecord(routes.image) &&
      typeof routes.image.connectionId === 'string';

    if (
      alreadyMigrated &&
      routes.text.connectionId === text.connectionId &&
      routes.vision.connectionId === vision.connectionId &&
      routes.image.connectionId === image.connectionId
    ) {
      continue;
    }

    console.log(`  update setup ${doc.id}:`, {
      text,
      vision,
      image,
    });

    stats.setupsUpdated += 1;

    if (!dryRun) {
      await doc.ref.set(
        {
          routes: { text, vision, image },
        },
        { merge: true }
      );
    }
  }
}

async function migrateConnectionDocs(
  db: admin.firestore.Firestore,
  dryRun: boolean,
  stats: MigrationStats
): Promise<void> {
  const primaryConnections: Array<{
    id: string;
    providerKind: 'gemini' | 'openrouter' | 'minimax';
  }> = [
    { id: PRIMARY_GEMINI_CONNECTION_ID, providerKind: 'gemini' },
    { id: PRIMARY_OPENROUTER_CONNECTION_ID, providerKind: 'openrouter' },
    { id: PRIMARY_MINIMAX_CONNECTION_ID, providerKind: 'minimax' },
    { id: PRIMARY_TOGETHER_CONNECTION_ID, providerKind: 'together' },
  ];

  for (const { id, providerKind } of primaryConnections) {
    const ref = db.collection(CONNECTIONS_COLLECTION).doc(id);
    const snap = await ref.get();
    const existing = snap.exists ? snap.data() : undefined;
    const payload = buildPrimaryConnectionDoc(id, providerKind, existing);

    if (!payload) {
      continue;
    }

    if (!snap.exists) {
      stats.connectionsCreated += 1;
      console.log(`  create connection ${id}`);
    } else {
      stats.connectionsUpdated += 1;
      console.log(`  update connection ${id}`);
    }

    if (!dryRun) {
      await ref.set(payload, { merge: true });
    }
  }
}

async function seedGeminiSecretIfNeeded(
  db: admin.firestore.Firestore,
  dryRun: boolean,
  stats: MigrationStats
): Promise<void> {
  const secretRef = db.collection(SECRETS_COLLECTION).doc(PRIMARY_GEMINI_CONNECTION_ID);
  const existing = await secretRef.get();

  if (existing.exists) {
    console.log('  gemini-primary secret already exists — skip seed');
    return;
  }

  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiApiKey) {
    console.warn(
      '  gemini-primary secret missing and GEMINI_API_KEY not set — configure via admin after migration'
    );
    return;
  }

  console.log('  seed gemini-primary secret from GEMINI_API_KEY');
  stats.geminiSecretSeeded = true;

  if (!dryRun) {
    const encrypted = encryptSecret(geminiApiKey);
    await secretRef.set({
      ...encrypted,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'migrate-llm-setup-routes',
    });

    await db.collection(CONNECTIONS_COLLECTION).doc(PRIMARY_GEMINI_CONNECTION_ID).set(
      {
        apiKeyConfigured: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'migrate-llm-setup-routes',
      },
      { merge: true }
    );
  }
}

async function main(): Promise<void> {
  const { dryRun, help } = parseArgs();
  if (help) {
    printHelp();
    return;
  }

  const projectId = getProjectId();

  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }

  const db = admin.firestore();
  const stats: MigrationStats = {
    setupsScanned: 0,
    setupsUpdated: 0,
    connectionsCreated: 0,
    connectionsUpdated: 0,
    geminiSecretSeeded: false,
  };

  console.log(`\nLLM setup route migration (${dryRun ? 'DRY RUN' : 'LIVE'}) — project ${projectId}\n`);

  console.log('1) Provider connection documents');
  await migrateConnectionDocs(db, dryRun, stats);

  console.log('\n2) Gemini secret seed');
  await seedGeminiSecretIfNeeded(db, dryRun, stats);

  console.log('\n3) LLM setup routes');
  await migrateSetupRoutes(db, dryRun, stats);

  console.log('\nDone:', stats);
  if (dryRun) {
    console.log('Re-run without --dry-run to apply changes.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
