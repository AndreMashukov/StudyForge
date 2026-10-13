#!/usr/bin/env node
/**
 * Write llmSetups.generationRoutes.escalation when it is missing.
 * Copies the diagramQuiz connection and model and sets workflow to direct.
 *
 * Usage:
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/backfill-escalation-route.ts --dry-run
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/backfill-escalation-route.ts
 */
import * as admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';
import { backfillMissingGenerationRoute } from '../../libs/shared-types/src/generation-routes-backfill';
import type { IGenerationRouteBackfill } from '../../libs/shared-types/src/generation-routes-backfill';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), 'functions/.env.local') });
config({ path: path.join(process.cwd(), 'functions/.env') });

if (!process.argv.includes('--emulator')) {
  delete process.env.FIRESTORE_EMULATOR_HOST;
}

const LLM_SETUPS_COLLECTION = 'llmSetups';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseRoute(value: unknown): IGenerationRouteBackfill | null {
  if (!isRecord(value)) {
    return null;
  }

  const connectionId =
    typeof value.connectionId === 'string' ? value.connectionId.trim() : '';
  const model = typeof value.model === 'string' ? value.model.trim() : '';
  const modality = value.modality;
  const workflow = value.workflow;

  if (
    !connectionId ||
    !model ||
    (modality !== 'text' &&
      modality !== 'vision' &&
      modality !== 'image' &&
      modality !== 'embedding') ||
    (workflow !== 'direct' &&
      workflow !== 'directWithRepair' &&
      workflow !== 'agentic')
  ) {
    return null;
  }

  return { connectionId, model, modality, workflow };
}

function getProjectId(): string {
  const projectId =
    process.env.GCLOUD_PROJECT ??
    process.env.GCP_PROJECT ??
    process.env.FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('Set GCLOUD_PROJECT before running this backfill.');
  }

  return projectId;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const projectId = getProjectId();

  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }

  const db = admin.firestore();
  const snapshot = await db.collection(LLM_SETUPS_COLLECTION).get();
  let updated = 0;
  let skipped = 0;
  let invalid = 0;

  console.log(
    `Escalation route backfill (${dryRun ? 'DRY RUN' : 'LIVE'}) project ${projectId}`,
  );

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const name = typeof data.name === 'string' ? data.name : doc.id;
    const routes = isRecord(data.generationRoutes) ? data.generationRoutes : null;
    if (!routes) {
      invalid += 1;
      console.error(`  invalid ${doc.id} (${name}): missing generationRoutes`);
      continue;
    }

    const existing = parseRoute(routes.escalation);
    if (existing) {
      skipped += 1;
      console.log(`  skip ${doc.id} (${name}): escalation already set`);
      continue;
    }

    const diagramQuiz = parseRoute(routes.diagramQuiz);
    const escalation = backfillMissingGenerationRoute('escalation', null, diagramQuiz);
    if (!escalation) {
      invalid += 1;
      console.error(`  invalid ${doc.id} (${name}): missing diagramQuiz route`);
      continue;
    }

    updated += 1;
    console.log(
      `  update ${doc.id} (${name}): ${escalation.connectionId} / ${escalation.model}`,
    );

    if (!dryRun) {
      await doc.ref.set(
        {
          generationRoutes: {
            ...routes,
            escalation,
          },
          updatedAt: new Date().toISOString(),
          updatedBy: 'backfill-escalation-route',
        },
        { merge: true },
      );
    }
  }

  console.log({ scanned: snapshot.size, updated, skipped, invalid });
  if (invalid > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
