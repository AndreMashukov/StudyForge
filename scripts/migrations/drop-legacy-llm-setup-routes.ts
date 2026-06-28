#!/usr/bin/env node
/**
 * Remove legacy llmSetups.routes after generationRoutes migration is complete.
 *
 * Usage:
 *   GCLOUD_PROJECT=your-project npx tsx scripts/migrations/drop-legacy-llm-setup-routes.ts --dry-run
 *   GCLOUD_PROJECT=your-project npx tsx scripts/migrations/drop-legacy-llm-setup-routes.ts
 */
import * as admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';
import {
  ALL_GENERATION_KINDS,
  isGenerationWorkflow,
} from '../../libs/shared-types/src/generation-kind-metadata';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), 'functions/.env.local') });
config({ path: path.join(process.cwd(), 'functions/.env') });

const LLM_SETUPS_COLLECTION = 'llmSetups';

interface MigrationStats {
  setupsScanned: number;
  setupsSkipped: number;
  setupsUpdated: number;
  setupsInvalid: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseCompleteGenerationRoutes(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  for (const kind of ALL_GENERATION_KINDS) {
    const route = value[kind];
    if (!isRecord(route)) {
      return false;
    }
    const connectionId =
      typeof route.connectionId === 'string' ? route.connectionId.trim() : '';
    const model = typeof route.model === 'string' ? route.model.trim() : '';
    const modality = route.modality;
    const workflow = route.workflow;
    if (
      !connectionId ||
      !model ||
      (modality !== 'text' && modality !== 'vision' && modality !== 'image') ||
      typeof workflow !== 'string' ||
      !isGenerationWorkflow(workflow)
    ) {
      return false;
    }
  }

  return true;
}

async function dropLegacyRoutes(
  db: admin.firestore.Firestore,
  dryRun: boolean,
  stats: MigrationStats
): Promise<void> {
  const snapshot = await db.collection(LLM_SETUPS_COLLECTION).get();

  for (const doc of snapshot.docs) {
    stats.setupsScanned += 1;
    const data = doc.data();
    const setupId = doc.id;
    const name = typeof data.name === 'string' ? data.name : setupId;

    if (!parseCompleteGenerationRoutes(data.generationRoutes)) {
      stats.setupsInvalid += 1;
      console.error(`  invalid ${setupId} (${name}) — incomplete generationRoutes`);
      continue;
    }

    if (!('routes' in data)) {
      stats.setupsSkipped += 1;
      console.log(`  skip ${setupId} (${name}) — no legacy routes field`);
      continue;
    }

    stats.setupsUpdated += 1;
    console.log(`  delete routes ${setupId} (${name})`);

    if (!dryRun) {
      await doc.ref.update({
        routes: admin.firestore.FieldValue.delete(),
        updatedAt: new Date().toISOString(),
        updatedBy: 'drop-legacy-llm-setup-routes',
      });
    }
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

  if (!projectId) {
    console.error('Set GCLOUD_PROJECT before running this migration.');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }

  const db = admin.firestore();
  const stats: MigrationStats = {
    setupsScanned: 0,
    setupsSkipped: 0,
    setupsUpdated: 0,
    setupsInvalid: 0,
  };

  console.log(`\nDrop legacy llmSetups.routes (${dryRun ? 'DRY RUN' : 'LIVE'}) — project ${projectId}\n`);
  await dropLegacyRoutes(db, dryRun, stats);

  console.log('\nSummary:');
  console.log(`  scanned: ${stats.setupsScanned}`);
  console.log(`  skipped: ${stats.setupsSkipped}`);
  console.log(`  updated: ${stats.setupsUpdated}`);
  console.log(`  invalid: ${stats.setupsInvalid}`);

  if (stats.setupsInvalid > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
