#!/usr/bin/env node
/**
 * Copy production MiniMax provider connection + secret into the Firestore emulator.
 * Uses production LLM_SETTINGS_ENCRYPTION_KEY (same ciphertext works locally).
 *
 * Usage:
 *   LLM_SETTINGS_ENCRYPTION_KEY=... npx tsx scripts/seed-setup/copy-production-minimax-to-emulator.ts
 */
import * as admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), 'functions/.env.local') });
config({ path: path.join(process.cwd(), 'functions/.secret.local') });

const PROJECT_ID = 'study-forge-202604';
const CONNECTION_ID = 'minimax-primary';
const CONNECTIONS = 'llmProviderConnections';
const SECRETS = 'llmProviderConnectionSecrets';

async function readProductionDocs(): Promise<{
  connection: FirebaseFirestore.DocumentData | null;
  secret: FirebaseFirestore.DocumentData | null;
}> {
  const savedEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIRESTORE_EMULATOR_HOST;

  const existing = admin.apps.find((app) => app.name === 'production');
  if (existing) {
    await existing.delete();
  }

  const prodApp = admin.initializeApp({ projectId: PROJECT_ID }, 'production');
  try {
    const db = prodApp.firestore();
    const [connectionSnap, secretSnap] = await Promise.all([
      db.collection(CONNECTIONS).doc(CONNECTION_ID).get(),
      db.collection(SECRETS).doc(CONNECTION_ID).get(),
    ]);

    return {
      connection: connectionSnap.exists ? (connectionSnap.data() ?? null) : null,
      secret: secretSnap.exists ? (secretSnap.data() ?? null) : null,
    };
  } finally {
    await prodApp.delete();
    if (savedEmulatorHost) {
      process.env.FIRESTORE_EMULATOR_HOST = savedEmulatorHost;
    }
  }
}

async function main(): Promise<void> {
  if (!process.env.LLM_SETTINGS_ENCRYPTION_KEY?.trim()) {
    throw new Error('LLM_SETTINGS_ENCRYPTION_KEY is required (use functions/.secret.local).');
  }

  console.log('Reading production MiniMax connection + secret …');
  const { connection, secret } = await readProductionDocs();

  if (!connection) {
    throw new Error(`Production ${CONNECTIONS}/${CONNECTION_ID} not found.`);
  }
  if (!secret) {
    throw new Error(`Production ${SECRETS}/${CONNECTION_ID} not found.`);
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }

  process.env.FIRESTORE_EMULATOR_HOST =
    process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';

  const db = admin.firestore();
  const now = new Date().toISOString();

  await db.collection(CONNECTIONS).doc(CONNECTION_ID).set(
    {
      ...connection,
      updatedAt: now,
      updatedBy: 'copy-production-minimax-to-emulator',
    },
    { merge: true }
  );

  await db.collection(SECRETS).doc(CONNECTION_ID).set(
    {
      ...secret,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'copy-production-minimax-to-emulator',
    },
    { merge: true }
  );

  console.log(`✅ Copied ${CONNECTION_ID} connection + encrypted secret to emulator.`);
}

main().catch((err) => {
  console.error('❌ Copy failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
