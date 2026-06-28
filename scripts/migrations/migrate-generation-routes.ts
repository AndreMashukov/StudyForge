#!/usr/bin/env node
/**
 * Backfill llmSetups.generationRoutes from legacy modality routes.
 *
 * Usage:
 *   GCLOUD_PROJECT=your-project npx tsx scripts/migrations/migrate-generation-routes.ts --dry-run
 *   GCLOUD_PROJECT=your-project npx tsx scripts/migrations/migrate-generation-routes.ts
 *   GCLOUD_PROJECT=your-project npx tsx scripts/migrations/migrate-generation-routes.ts --force
 *
 * Env:
 *   GOOGLE_APPLICATION_CREDENTIALS or gcloud ADC
 *   FIRESTORE_EMULATOR_HOST — optional for local emulator
 */
import * as admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';
import {
  ALL_GENERATION_KINDS,
  GENERATION_KIND_METADATA,
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

function printHelp(): void {
  console.log(`
Backfill generationRoutes on LLM setups

  yarn migrate:generation-routes [--dry-run] [--force]

  Examples:
    yarn migrate:generation-routes --dry-run
    yarn migrate:generation-routes
    yarn migrate:generation-routes --force
`);
}

function parseArgs(): { dryRun: boolean; force: boolean; help: boolean } {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    return { dryRun: false, force: false, help: true };
  }
  return {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    help: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getProjectId(): string {
  const projectId =
    process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? process.env.FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('Set GCLOUD_PROJECT (or GCP_PROJECT) before running migration.');
  }

  return projectId;
}

interface ILegacyModalityRoute {
  connectionId: string;
  model: string;
}

interface ILegacySetupRoutes {
  text: ILegacyModalityRoute;
  vision: ILegacyModalityRoute;
  image: ILegacyModalityRoute;
}

function parseModalityRoute(value: unknown): ILegacyModalityRoute | null {
  if (!isRecord(value)) {
    return null;
  }

  const connectionId =
    typeof value.connectionId === 'string' ? value.connectionId.trim() : '';
  const model = typeof value.model === 'string' ? value.model.trim() : '';

  if (!connectionId || !model) {
    return null;
  }

  return { connectionId, model };
}

function parseLegacyRoutes(value: unknown): ILegacySetupRoutes | null {
  if (!isRecord(value)) {
    return null;
  }

  const text = parseModalityRoute(value.text);
  const vision = parseModalityRoute(value.vision);
  const image = parseModalityRoute(value.image);

  if (!text || !vision || !image) {
    return null;
  }

  return { text, vision, image };
}

function parseExistingGenerationRoutes(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  for (const kind of ALL_GENERATION_KINDS) {
    const entry = value[kind];
    if (!isRecord(entry)) {
      return false;
    }

    const connectionId =
      typeof entry.connectionId === 'string' ? entry.connectionId.trim() : '';
    const model = typeof entry.model === 'string' ? entry.model.trim() : '';
    const modality = entry.modality;
    const workflow = entry.workflow;

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

function buildGenerationRoutesFromLegacy(routes: ILegacySetupRoutes): Record<string, unknown> {
  const routesByModality = {
    text: routes.text,
    vision: routes.vision,
    image: routes.image,
  };

  const generationRoutes: Record<string, unknown> = {};

  for (const kind of ALL_GENERATION_KINDS) {
    const metadata = GENERATION_KIND_METADATA[kind];
    const source = routesByModality[metadata.requiredModality];
    generationRoutes[kind] = {
      connectionId: source.connectionId,
      model: source.model,
      modality: metadata.requiredModality,
      workflow: metadata.defaultWorkflow,
    };
  }

  return generationRoutes;
}

async function migrateGenerationRoutes(
  db: admin.firestore.Firestore,
  dryRun: boolean,
  force: boolean,
  stats: MigrationStats
): Promise<void> {
  const snapshot = await db.collection(LLM_SETUPS_COLLECTION).get();

  for (const doc of snapshot.docs) {
    stats.setupsScanned += 1;
    const data = doc.data();
    const setupId = doc.id;
    const name = typeof data.name === 'string' ? data.name : setupId;

    const hasCompleteGenerationRoutes = parseExistingGenerationRoutes(data.generationRoutes);
    if (hasCompleteGenerationRoutes && !force) {
      stats.setupsSkipped += 1;
      console.log(`  skip ${setupId} (${name}) — generationRoutes already complete`);
      continue;
    }

    const legacyRoutes = parseLegacyRoutes(data.routes);
    if (!legacyRoutes) {
      stats.setupsInvalid += 1;
      console.error(`  invalid ${setupId} (${name}) — missing legacy routes for backfill`);
      continue;
    }

    const generationRoutes = buildGenerationRoutesFromLegacy(legacyRoutes);
    stats.setupsUpdated += 1;
    console.log(`  update ${setupId} (${name})`);

    if (!dryRun) {
      await doc.ref.set(
        {
          generationRoutes,
          updatedAt: new Date().toISOString(),
          updatedBy: 'migrate-generation-routes',
        },
        { merge: true }
      );
    }
  }
}

async function verifyGenerationRoutes(db: admin.firestore.Firestore): Promise<boolean> {
  const snapshot = await db.collection(LLM_SETUPS_COLLECTION).get();
  let valid = true;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!parseExistingGenerationRoutes(data.generationRoutes)) {
      valid = false;
      console.error(`  verification failed: ${doc.id} missing complete generationRoutes`);
    }
  }

  return valid;
}

async function main(): Promise<void> {
  const { dryRun, force, help } = parseArgs();
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
    setupsSkipped: 0,
    setupsUpdated: 0,
    setupsInvalid: 0,
  };

  console.log(
    `\nGeneration routes migration (${dryRun ? 'DRY RUN' : 'LIVE'}) — project ${projectId}\n`
  );

  await migrateGenerationRoutes(db, dryRun, force, stats);

  console.log('\nDone:', stats);

  if (!dryRun) {
    const verified = await verifyGenerationRoutes(db);
    if (!verified) {
      console.error('\nVerification failed — some setups still lack complete generationRoutes.');
      process.exit(1);
    }
    console.log('\nVerification passed — all setups have complete generationRoutes.');
  } else {
    console.log('Re-run without --dry-run to apply changes.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
