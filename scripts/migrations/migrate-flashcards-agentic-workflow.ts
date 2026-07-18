#!/usr/bin/env node
/**
 * Normalize llmSetups.generationRoutes.flashcards.workflow to agentic.
 *
 * Usage:
 *   GCLOUD_PROJECT=your-project npx tsx scripts/migrations/migrate-flashcards-agentic-workflow.ts --dry-run
 *   GCLOUD_PROJECT=your-project npx tsx scripts/migrations/migrate-flashcards-agentic-workflow.ts
 */
import * as admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), 'functions/.env.local') });
config({ path: path.join(process.cwd(), 'functions/.env') });

const LLM_SETUPS_COLLECTION = 'llmSetups';

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

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const projectId = getProjectId();

  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }

  const db = admin.firestore();
  const snap = await db.collection(LLM_SETUPS_COLLECTION).get();

  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    scanned += 1;
    const data = doc.data();
    const routes = data.generationRoutes;
    if (!isRecord(routes) || !isRecord(routes.flashcards)) {
      skipped += 1;
      continue;
    }

    const flashcards = routes.flashcards;
    if (flashcards.workflow === 'agentic') {
      skipped += 1;
      continue;
    }

    console.log(`${dryRun ? '[dry-run] ' : ''}Updating ${doc.id}: flashcards.workflow ${String(flashcards.workflow)} -> agentic`);

    if (!dryRun) {
      await doc.ref.update({
        'generationRoutes.flashcards.workflow': 'agentic',
        updatedAt: new Date().toISOString(),
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
