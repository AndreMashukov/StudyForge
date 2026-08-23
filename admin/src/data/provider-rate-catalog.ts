import 'server-only';

import type { IProviderRateCatalogEntry } from '@shared-types';
import { buildRateCatalogDocId } from '@shared-types';
import { requireAdminSession } from '../auth/session';
import { getAdminFirestore } from '../firebase/admin';

const RATE_CATALOG_COLLECTION = 'providerRateCatalog';
const FIRESTORE_BATCH_LIMIT = 400;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNonNegativeFinite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function asPositiveFinite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function omitUndefined(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      result[key] = entry;
    }
  }
  return result;
}

function parseRateCatalogEntry(
  id: string,
  data: FirebaseFirestore.DocumentData,
): IProviderRateCatalogEntry | null {
  const providerKind = data.providerKind;
  const model = typeof data.model === 'string' ? data.model.trim() : '';
  const meter = data.meter;
  if (
    (providerKind !== 'gemini' &&
      providerKind !== 'openrouter' &&
      providerKind !== 'minimax' &&
      providerKind !== 'together') ||
    !model ||
    (meter !== 'token' &&
      meter !== 'image_megapixel' &&
      meter !== 'embedding_token')
  ) {
    return null;
  }

  return {
    id,
    providerKind,
    model,
    meter,
    inputUsdPer1M: asNonNegativeFinite(data.inputUsdPer1M),
    outputUsdPer1M: asNonNegativeFinite(data.outputUsdPer1M),
    cachedInputUsdPer1M: asNonNegativeFinite(data.cachedInputUsdPer1M),
    imageUsdPerMegapixel: asNonNegativeFinite(data.imageUsdPerMegapixel),
    defaultSteps: asPositiveFinite(data.defaultSteps),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    source: typeof data.source === 'string' ? data.source : undefined,
  };
}

function chunkEntries<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function persistProviderRateCatalog(
  entries: IProviderRateCatalogEntry[],
): Promise<number> {
  if (entries.length === 0) {
    return 0;
  }

  const now = new Date().toISOString();
  const db = getAdminFirestore();

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

  return entries.length;
}

export async function readProviderRateCatalog(): Promise<
  IProviderRateCatalogEntry[]
> {
  await requireAdminSession();

  const snapshot = await getAdminFirestore()
    .collection(RATE_CATALOG_COLLECTION)
    .get();

  const entries: IProviderRateCatalogEntry[] = [];
  for (const doc of snapshot.docs) {
    if (!isRecord(doc.data())) {
      continue;
    }
    const parsed = parseRateCatalogEntry(doc.id, doc.data());
    if (parsed) {
      entries.push(parsed);
    }
  }

  return entries.sort((left, right) => {
    if (left.providerKind !== right.providerKind) {
      return left.providerKind.localeCompare(right.providerKind);
    }
    return left.model.localeCompare(right.model);
  });
}
