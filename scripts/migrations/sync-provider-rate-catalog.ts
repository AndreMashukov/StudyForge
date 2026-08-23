#!/usr/bin/env node
/**
 * Sync providerRateCatalog in Firestore from provider list-models APIs.
 *
 * Always writes checked-in fallbacks. If provider API keys are available,
 * overlays the live Together / OpenRouter / MiniMax catalogs.
 *
 * Usage:
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/sync-provider-rate-catalog.ts --dry-run
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/sync-provider-rate-catalog.ts
 *
 * Env:
 *   GOOGLE_APPLICATION_CREDENTIALS or gcloud ADC
 *   TOGETHER_API_KEY / TOGETHER_AI_API_KEY — optional live Together catalog
 *   OPENROUTER_API_KEY — optional live OpenRouter catalog
 *   MINIMAX_API_KEY — optional live MiniMax catalog
 *   LLM_SETTINGS_ENCRYPTION_KEY — optional; decrypts stored provider secrets
 */
import * as admin from 'firebase-admin';
import { createDecipheriv, createHash } from 'node:crypto';
import * as path from 'path';
import { config } from 'dotenv';
import {
  buildProviderRateCatalogForSync,
  buildRateCatalogDocId,
  FALLBACK_PROVIDER_RATE_CATALOG,
  type IProviderRateCatalogEntry,
  type LlmProviderKind,
} from '../../libs/shared-types/src/index';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), 'admin/.env.local') });
config({ path: path.join(process.cwd(), 'functions/.env.local') });
config({ path: path.join(process.cwd(), 'functions/.env') });
config({ path: path.join(process.cwd(), 'functions/.secret.local') });

if (!process.argv.includes('--emulator')) {
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
}

const RATE_CATALOG_COLLECTION = 'providerRateCatalog';
const SECRETS_COLLECTION = 'llmProviderConnectionSecrets';
const CONNECTIONS_COLLECTION = 'llmProviderConnections';
const FIRESTORE_BATCH_LIMIT = 400;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

const PROVIDER_FETCH: Record<
  Exclude<LlmProviderKind, 'gemini'>,
  { connectionId: string; envKeys: string[]; defaultBaseUrl: string }
> = {
  together: {
    connectionId: 'together-primary',
    envKeys: ['TOGETHER_API_KEY', 'TOGETHER_AI_API_KEY'],
    defaultBaseUrl: 'https://api.together.ai/v1',
  },
  openrouter: {
    connectionId: 'openrouter-primary',
    envKeys: ['OPENROUTER_API_KEY'],
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  },
  minimax: {
    connectionId: 'minimax-primary',
    envKeys: ['MINIMAX_API_KEY'],
    defaultBaseUrl: 'https://api.minimax.io/v1',
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getProjectId(): string {
  return (
    process.env.GCLOUD_PROJECT ??
    process.env.GCP_PROJECT ??
    process.env.FIREBASE_PROJECT_ID ??
    'study-forge-202604'
  );
}

function parseArgs(): { dryRun: boolean; fallbacksOnly: boolean } {
  return {
    dryRun: process.argv.includes('--dry-run'),
    fallbacksOnly: process.argv.includes('--fallbacks-only'),
  };
}

function omitUndefined(value: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      result[key] = entry;
    }
  }
  return result;
}

function chunkEntries<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function decryptStoredSecret(data: FirebaseFirestore.DocumentData): string | null {
  const secret = process.env.LLM_SETTINGS_ENCRYPTION_KEY;
  if (!secret) {
    return null;
  }
  if (
    data.algorithm !== ENCRYPTION_ALGORITHM ||
    typeof data.iv !== 'string' ||
    typeof data.authTag !== 'string' ||
    typeof data.ciphertext !== 'string'
  ) {
    return null;
  }

  const key = createHash('sha256').update(secret).digest();
  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    key,
    Buffer.from(data.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(data.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(data.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

async function readProviderApiKey(
  db: FirebaseFirestore.Firestore,
  providerKind: Exclude<LlmProviderKind, 'gemini'>,
): Promise<{ apiKey: string; baseUrl: string } | null> {
  const config = PROVIDER_FETCH[providerKind];
  for (const envKey of config.envKeys) {
    const fromEnv = process.env[envKey]?.trim();
    if (fromEnv) {
      return { apiKey: fromEnv, baseUrl: config.defaultBaseUrl };
    }
  }

  const secretSnap = await db.collection(SECRETS_COLLECTION).doc(config.connectionId).get();
  if (!secretSnap.exists) {
    return null;
  }
  const apiKey = decryptStoredSecret(secretSnap.data() ?? {});
  if (!apiKey) {
    return null;
  }

  const connectionSnap = await db
    .collection(CONNECTIONS_COLLECTION)
    .doc(config.connectionId)
    .get();
  const connection = connectionSnap.data() ?? {};
  const baseUrl =
    typeof connection.baseUrl === 'string' && connection.baseUrl.trim()
      ? connection.baseUrl.trim()
      : config.defaultBaseUrl;

  return { apiKey, baseUrl };
}

async function fetchProviderPayload(
  providerKind: Exclude<LlmProviderKind, 'gemini'>,
  baseUrl: string,
  apiKey: string,
): Promise<unknown> {
  const url =
    providerKind === 'openrouter'
      ? `${baseUrl.replace(/\/$/, '')}/models/user`
      : `${baseUrl.replace(/\/$/, '')}/models`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(20_000),
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message =
      isRecord(payload) &&
      isRecord(payload.error) &&
      typeof payload.error.message === 'string'
        ? payload.error.message
        : response.statusText;
    throw new Error(`${providerKind} catalog fetch failed (${response.status}): ${message}`);
  }
  return payload;
}

function mergeCatalogs(
  catalogs: IProviderRateCatalogEntry[][],
): IProviderRateCatalogEntry[] {
  const merged = new Map<string, IProviderRateCatalogEntry>();
  for (const catalog of catalogs) {
    for (const entry of catalog) {
      const key = `${entry.providerKind}::${entry.model}::${entry.meter}`;
      merged.set(key, {
        ...entry,
        id: buildRateCatalogDocId(entry.providerKind, entry.model),
      });
    }
  }
  return Array.from(merged.values()).sort((left, right) => {
    if (left.providerKind !== right.providerKind) {
      return left.providerKind.localeCompare(right.providerKind);
    }
    return left.model.localeCompare(right.model);
  });
}

async function writeCatalog(
  db: FirebaseFirestore.Firestore,
  entries: IProviderRateCatalogEntry[],
): Promise<void> {
  const now = new Date().toISOString();
  for (const chunk of chunkEntries(entries, FIRESTORE_BATCH_LIMIT)) {
    const batch = db.batch();
    for (const entry of chunk) {
      const docId = buildRateCatalogDocId(entry.providerKind, entry.model);
      batch.set(
        db.collection(RATE_CATALOG_COLLECTION).doc(docId),
        omitUndefined({
          id: docId,
          providerKind: entry.providerKind,
          model: entry.model,
          meter: entry.meter,
          inputUsdPer1M: entry.inputUsdPer1M,
          outputUsdPer1M: entry.outputUsdPer1M,
          cachedInputUsdPer1M: entry.cachedInputUsdPer1M,
          imageUsdPerMegapixel: entry.imageUsdPerMegapixel,
          defaultSteps: entry.defaultSteps,
          source: entry.source,
          updatedAt: now,
        }),
      );
    }
    await batch.commit();
  }
}

async function main(): Promise<void> {
  const { dryRun, fallbacksOnly } = parseArgs();
  const projectId = getProjectId();
  admin.initializeApp({ projectId });
  const db = admin.firestore();

  const catalogs: IProviderRateCatalogEntry[][] = [FALLBACK_PROVIDER_RATE_CATALOG];
  const sources: string[] = [`fallback (${FALLBACK_PROVIDER_RATE_CATALOG.length})`];

  for (const providerKind of Object.keys(PROVIDER_FETCH) as Array<
    Exclude<LlmProviderKind, 'gemini'>
  >) {
    if (fallbacksOnly) {
      sources.push(`${providerKind}: skipped (--fallbacks-only)`);
      continue;
    }
    console.log(`Fetching ${providerKind} catalog...`);
    try {
      const credentials = await readProviderApiKey(db, providerKind);
      if (!credentials) {
        sources.push(`${providerKind}: skipped (no api key)`);
        continue;
      }
      const payload = await fetchProviderPayload(
        providerKind,
        credentials.baseUrl,
        credentials.apiKey,
      );
      const entries = buildProviderRateCatalogForSync(providerKind, payload);
      catalogs.push(entries);
      sources.push(`${providerKind}: ${entries.length} entries`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sources.push(`${providerKind}: failed (${message})`);
    }
  }

  const merged = mergeCatalogs(catalogs);
  const qwen38 = merged.find((entry) => entry.model === 'Qwen/Qwen3.8-2.4T-A95B');

  console.log(`Project: ${projectId}`);
  console.log(`Mode: ${dryRun ? 'dry-run' : 'write'}`);
  console.log(`Sources:\n  ${sources.join('\n  ')}`);
  console.log(`Merged catalog: ${merged.length} entries`);
  if (qwen38) {
    console.log(
      `Qwen3.8: ${qwen38.source} input=${qwen38.inputUsdPer1M} output=${qwen38.outputUsdPer1M} cached=${qwen38.cachedInputUsdPer1M}`,
    );
  } else {
    console.log('Qwen3.8: missing from merged catalog');
  }

  if (dryRun) {
    return;
  }

  await writeCatalog(db, merged);
  console.log(`Wrote ${merged.length} docs to ${RATE_CATALOG_COLLECTION}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
