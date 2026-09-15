#!/usr/bin/env node
/**
 * Retarget agentKnowledgeEmbedding routes from Together E5 instruct to OpenRouter E5 large.
 *
 * Usage:
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/retarget-embeddings-to-openrouter.ts --dry-run
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/retarget-embeddings-to-openrouter.ts
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/retarget-embeddings-to-openrouter.ts --emulator
 */
import * as admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';
import {
  GENERATION_KIND_METADATA,
  PRIMARY_OPENROUTER_CONNECTION_ID,
  PRIMARY_TOGETHER_CONNECTION_ID,
} from '../../libs/shared-types/src/index';

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
const TARGET_CONNECTION_ID = PRIMARY_OPENROUTER_CONNECTION_ID;
const TARGET_MODEL = 'intfloat/multilingual-e5-large';
const LEGACY_TOGETHER_MODEL = 'intfloat/multilingual-e5-large-instruct';

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

function parseEmbeddingRoute(value: unknown): {
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

function shouldRetargetRoute(route: {
  connectionId: string;
  model: string;
  modality: string;
}): boolean {
  if (route.modality !== 'embedding') {
    return false;
  }

  if (
    route.connectionId === TARGET_CONNECTION_ID &&
    route.model === TARGET_MODEL
  ) {
    return false;
  }

  return (
    route.connectionId === PRIMARY_TOGETHER_CONNECTION_ID ||
    route.model === LEGACY_TOGETHER_MODEL ||
    route.model.includes('multilingual-e5-large-instruct')
  );
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const projectId = getProjectId();

  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
  }

  const db = admin.firestore();
  const now = new Date().toISOString();
  const embeddingMetadata = GENERATION_KIND_METADATA.agentKnowledgeEmbedding;

  console.log(
    `${dryRun ? '[dry-run] ' : ''}Retargeting embeddings to ${TARGET_CONNECTION_ID} / ${TARGET_MODEL}`,
  );

  const openRouterRef = db
    .collection(CONNECTIONS_COLLECTION)
    .doc(TARGET_CONNECTION_ID);
  const openRouterSnap = await openRouterRef.get();

  if (!openRouterSnap.exists) {
    console.warn(
      `Warning: ${TARGET_CONNECTION_ID} does not exist. Migration will still update llmSetups.`,
    );
  } else if (!dryRun) {
    await openRouterRef.set(
      {
        defaultEmbeddingModel: TARGET_MODEL,
        updatedAt: now,
        updatedBy: 'migration:retarget-embeddings-to-openrouter',
      },
      { merge: true },
    );
    console.log(`Updated ${TARGET_CONNECTION_ID}.defaultEmbeddingModel`);
  } else {
    console.log(
      `[dry-run] Would set ${TARGET_CONNECTION_ID}.defaultEmbeddingModel = ${TARGET_MODEL}`,
    );
  }

  const setupsSnap = await db.collection(LLM_SETUPS_COLLECTION).get();
  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  console.log('\nSetup ID\tCurrent route\tAction');
  console.log('--------\t-------------\t------');

  for (const doc of setupsSnap.docs) {
    scanned += 1;
    const data = doc.data();
    const routes = isRecord(data.generationRoutes) ? data.generationRoutes : {};
    const currentRoute = parseEmbeddingRoute(routes.agentKnowledgeEmbedding);

    if (!currentRoute) {
      skipped += 1;
      console.log(`${doc.id}\t(missing route)\tskip`);
      continue;
    }

    const currentLabel = `${currentRoute.connectionId} / ${currentRoute.model}`;

    if (!shouldRetargetRoute(currentRoute)) {
      skipped += 1;
      console.log(`${doc.id}\t${currentLabel}\tskip`);
      continue;
    }

    const nextRoute = {
      connectionId: TARGET_CONNECTION_ID,
      model: TARGET_MODEL,
      modality: 'embedding' as const,
      workflow: currentRoute.workflow || embeddingMetadata.defaultWorkflow,
    };

    console.log(
      `${doc.id}\t${currentLabel}\tupdate to ${TARGET_CONNECTION_ID} / ${TARGET_MODEL}`,
    );

    if (!dryRun) {
      await doc.ref.update({
        'generationRoutes.agentKnowledgeEmbedding': nextRoute,
        updatedAt: now,
        updatedBy: 'migration:retarget-embeddings-to-openrouter',
      });
    }

    updated += 1;
  }

  console.log(
    JSON.stringify({ scanned, updated, skipped, dryRun, projectId }, null, 2),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
