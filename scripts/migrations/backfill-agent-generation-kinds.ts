#!/usr/bin/env node
/**
 * Backfill llmSetups.generationRoutes for directoryAgent, agentExecutor, and agentKnowledgeEmbedding.
 *
 * Usage:
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/backfill-agent-generation-kinds.ts --dry-run
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/backfill-agent-generation-kinds.ts
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/backfill-agent-generation-kinds.ts --emulator
 */
import * as admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), 'functions/.env.local') });
config({ path: path.join(process.cwd(), 'functions/.env') });

if (!process.argv.includes('--emulator')) {
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
}

const LLM_SETUPS_COLLECTION = 'llmSetups';
const CONNECTIONS_COLLECTION = 'llmProviderConnections';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-004';
const DEFAULT_EMBEDDING_CONNECTION_ID = 'gemini-primary';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getProjectId(): string {
  const projectId =
    process.env.GCLOUD_PROJECT ??
    process.env.GCP_PROJECT ??
    process.env.FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error(
      'Set GCLOUD_PROJECT (or GCP_PROJECT) before running migration.',
    );
  }

  return projectId;
}

function parseRoute(value: unknown): {
  connectionId: string;
  model: string;
  modality: string;
  workflow: string;
} | null {
  if (!isRecord(value)) {
    return null;
  }

  const connectionId =
    typeof value.connectionId === 'string' ? value.connectionId.trim() : '';
  const model = typeof value.model === 'string' ? value.model.trim() : '';
  const modality = typeof value.modality === 'string' ? value.modality : '';
  const workflow = typeof value.workflow === 'string' ? value.workflow : '';

  if (!connectionId || !model || !modality || !workflow) {
    return null;
  }

  return { connectionId, model, modality, workflow };
}

async function ensureGeminiEmbeddingSupport(
  db: FirebaseFirestore.Firestore,
  dryRun: boolean,
): Promise<void> {
  const geminiRef = db
    .collection(CONNECTIONS_COLLECTION)
    .doc(DEFAULT_EMBEDDING_CONNECTION_ID);
  const geminiSnap = await geminiRef.get();
  if (!geminiSnap.exists) {
    console.warn(
      `Skipping connection update: ${DEFAULT_EMBEDDING_CONNECTION_ID} not found`,
    );
    return;
  }

  const data = geminiSnap.data() ?? {};
  const modalities = Array.isArray(data.supportedModalities)
    ? data.supportedModalities.filter(
        (entry): entry is string => typeof entry === 'string',
      )
    : [];
  const models = Array.isArray(data.availableModels)
    ? [...data.availableModels]
    : [];
  const hasEmbeddingModality = modalities.includes('embedding');
  const hasEmbeddingModel = models.some(
    (entry) => isRecord(entry) && entry.id === DEFAULT_EMBEDDING_MODEL,
  );

  if (hasEmbeddingModality && hasEmbeddingModel) {
    return;
  }

  const nextModalities = hasEmbeddingModality
    ? modalities
    : [...modalities, 'embedding'];
  const nextModels = hasEmbeddingModel
    ? models
    : [
        ...models,
        {
          id: DEFAULT_EMBEDDING_MODEL,
          displayName: DEFAULT_EMBEDDING_MODEL,
          supportedModalities: ['embedding'],
        },
      ];

  console.log(
    `${dryRun ? '[dry-run] ' : ''}Updating ${DEFAULT_EMBEDDING_CONNECTION_ID} embedding support`,
  );

  if (!dryRun) {
    await geminiRef.update({
      supportedModalities: nextModalities,
      availableModels: nextModels,
      updatedAt: new Date().toISOString(),
    });
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const projectId = getProjectId();

  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }

  const db = admin.firestore();
  await ensureGeminiEmbeddingSupport(db, dryRun);

  const snap = await db.collection(LLM_SETUPS_COLLECTION).get();
  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    scanned += 1;
    const data = doc.data();
    const routes = data.generationRoutes;
    if (!isRecord(routes)) {
      skipped += 1;
      continue;
    }

    const patch: Record<string, unknown> = {};
    const directoryChat = parseRoute(routes.directoryChat);

    if (!parseRoute(routes.directoryAgent)) {
      if (!directoryChat) {
        console.warn(
          `Skip ${doc.id}: missing directoryChat for directoryAgent fallback`,
        );
        skipped += 1;
        continue;
      }
      patch['generationRoutes.directoryAgent'] = {
        connectionId: directoryChat.connectionId,
        model: directoryChat.model,
        modality: 'text',
        workflow: 'direct',
      };
    }

    if (!parseRoute(routes.agentExecutor)) {
      if (!directoryChat) {
        console.warn(
          `Skip ${doc.id}: missing directoryChat for agentExecutor fallback`,
        );
        skipped += 1;
        continue;
      }
      patch['generationRoutes.agentExecutor'] = {
        connectionId: directoryChat.connectionId,
        model: directoryChat.model,
        modality: 'text',
        workflow: 'direct',
      };
    }

    if (!parseRoute(routes.agentKnowledgeEmbedding)) {
      patch['generationRoutes.agentKnowledgeEmbedding'] = {
        connectionId: DEFAULT_EMBEDDING_CONNECTION_ID,
        model: DEFAULT_EMBEDDING_MODEL,
        modality: 'embedding',
        workflow: 'direct',
      };
    }

    if (Object.keys(patch).length === 0) {
      skipped += 1;
      continue;
    }

    console.log(
      `${dryRun ? '[dry-run] ' : ''}Updating ${doc.id}: ${Object.keys(patch).join(', ')}`,
    );

    if (!dryRun) {
      await doc.ref.update({
        ...patch,
        updatedAt: new Date().toISOString(),
        updatedBy: 'migration:backfill-agent-generation-kinds',
      });
    }
    updated += 1;
  }

  console.log(JSON.stringify({ scanned, updated, skipped, dryRun }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
