import { randomUUID } from 'node:crypto';
import { getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import {
  NARRATION_SCHEMA_VERSION,
  sampleNarrationProse,
  screenNarrationScript,
  summarizeNarrationStatus,
  type DocumentNarratability,
} from '@shared-types';
import { evaluateDocumentNarratable } from '@study-forge/backend-llm/llm/document-narratable-decision-client';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import {
  isDocumentReadyForNarration,
  loadNarrationSource,
  narrationContentFieldsChanged,
  readNarrationDocument,
  readNarrationDocumentData,
  readNarrationDocumentFields,
  type INarrationSource,
} from './narration-source';
import {
  narrationRecordRef,
  parseStoredNarrationRecord,
  readNarrationRecord,
  removeNarration,
} from './narration-store';
import {
  processNarrationAudioDeletionSoon,
  queueNarrationAudioDeletion,
} from './narration-audio-deletions';
import { keyNarrationParts, remapNarrationParts } from './narration-planning';

/** True when the stored check result still describes the document's spoken text. */
export function isNarratabilityCurrent(
  narratability: DocumentNarratability | undefined,
  contentHash: string,
): narratability is DocumentNarratability {
  return (
    narratability !== undefined &&
    narratability.contentHash === contentHash &&
    narratability.schemaVersion === NARRATION_SCHEMA_VERSION
  );
}

/**
 * While one request asks the decision model about a document's content, others
 * for the same content wait for its result instead of asking again.
 * `narratabilityChecks/{userId}_{documentId}` — server only.
 */
const CHECK_LEASE_MS = 60_000;

interface ICheckLease {
  ref: DocumentReference;
  token: string;
}

async function claimCheckLease(
  userId: string,
  documentId: string,
  contentHash: string,
): Promise<ICheckLease | null> {
  const ref = getFirestore()
    .collection('narratabilityChecks')
    .doc(`${userId}_${documentId}`);
  const token = randomUUID();
  const claimed = await getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const startedAt = Date.parse(String(snapshot.get('startedAt') ?? ''));
    if (
      snapshot.get('contentHash') === contentHash &&
      Number.isFinite(startedAt) &&
      Date.now() - startedAt < CHECK_LEASE_MS
    ) {
      return false;
    }
    transaction.set(ref, {
      userId,
      documentId,
      contentHash,
      token,
      startedAt: new Date().toISOString(),
    });
    return true;
  });
  return claimed ? { ref, token } : null;
}

async function releaseCheckLease(lease: ICheckLease): Promise<void> {
  await getFirestore()
    .runTransaction(async (transaction) => {
      const snapshot = await transaction.get(lease.ref);
      if (snapshot.get('token') === lease.token) transaction.delete(lease.ref);
    })
    // An unreleased lease only expires.
    .catch(() => undefined);
}

type JudgeOutcome =
  | { kind: 'judged'; narratability: DocumentNarratability }
  | { kind: 'unanswered' }
  | { kind: 'pending' };

/**
 * The code screen, then the decision model. Holds the check lease while the
 * model is asked; the caller releases it once the result is stored.
 */
async function judge(
  userId: string,
  documentId: string,
  source: INarrationSource,
  beforeDecision: (() => Promise<void>) | undefined,
): Promise<{ outcome: JudgeOutcome; lease: ICheckLease | null }> {
  const base = {
    spokenCharCount: source.script.spokenCharCount,
    contentHash: source.contentHash,
    schemaVersion: NARRATION_SCHEMA_VERSION,
    scriptVersion: source.script.scriptVersion,
    checkedAt: new Date().toISOString(),
  };
  const screen = screenNarrationScript(source.script);
  if (screen.outcome === 'notNarratable') {
    return {
      outcome: {
        kind: 'judged',
        narratability: {
          ...base,
          status: 'notNarratable',
          reason: screen.reason,
        },
      },
      lease: null,
    };
  }

  const lease = await claimCheckLease(userId, documentId, source.contentHash);
  if (!lease) return { outcome: { kind: 'pending' }, lease: null };
  try {
    // E.g. a rate limit: it fails the request, it is not an unanswered check.
    await beforeDecision?.();
  } catch (error) {
    await releaseCheckLease(lease);
    throw error;
  }

  try {
    const decision = await evaluateDocumentNarratable({
      userId,
      proseSample: sampleNarrationProse(source.script),
    });
    const narratability: DocumentNarratability = decision.narratable
      ? { ...base, status: 'narratable', probability: decision.probability }
      : {
          ...base,
          status: 'notNarratable',
          reason: 'notSuitable',
          probability: decision.probability,
        };
    return { outcome: { kind: 'judged', narratability }, lease };
  } catch (error) {
    // Unanswered is not "no": the document stays unjudged and is judged again later.
    logger.warn('Narratable check could not be answered', {
      userId,
      message: error instanceof Error ? error.message : String(error),
    });
    await releaseCheckLease(lease);
    return { outcome: { kind: 'unanswered' }, lease: null };
  }
}

/**
 * Brings the stored narration in step with the document: removes it when the
 * document is not narratable, otherwise keeps the parts whose text is still
 * planned (moved to their new place) and deletes the rest. Parts for new text
 * are not added; the next listen offers to narrate them.
 */
async function reconcileNarration(
  userId: string,
  documentId: string,
  source: INarrationSource,
  narratability: DocumentNarratability,
): Promise<void> {
  if (narratability.status === 'notNarratable') {
    await removeNarration(userId, documentId);
    return;
  }

  const ref = narrationRecordRef(userId, documentId);
  const result = await getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const record = parseStoredNarrationRecord(snapshot.data());
    if (!record || record.contentHash === source.contentHash || record.runId) {
      // A running generation reconciles when it finishes.
      return null;
    }
    const { kept, dropped } = remapNarrationParts(
      record.parts,
      keyNarrationParts(source.plan, record.voice, record.model),
    );
    transaction.update(ref, {
      parts: kept,
      contentHash: source.contentHash,
      status: kept.length ? summarizeNarrationStatus(kept) : 'failed',
      updatedAt: new Date().toISOString(),
    });
    return {
      removedParts: dropped.length,
      deletionId: queueNarrationAudioDeletion(
        transaction,
        userId,
        documentId,
        dropped,
      ),
    };
  });
  if (result?.removedParts) {
    await processNarrationAudioDeletionSoon(result.deletionId);
    logger.info('Stale narration parts removed', {
      userId,
      documentId,
      removedParts: result.removedParts,
    });
  }
}

/**
 * For a result that is already current: finishes a reconciliation that failed
 * after the result was stored, without asking the model again.
 */
async function reconcileIfBehind(
  userId: string,
  documentId: string,
  source: INarrationSource,
  narratability: DocumentNarratability,
): Promise<void> {
  const record = await readNarrationRecord(userId, documentId);
  if (!record) return;
  if (
    narratability.status === 'notNarratable' ||
    record.contentHash !== source.contentHash
  ) {
    await reconcileNarration(userId, documentId, source, narratability);
  }
}

/** Reconciles a narration with the document's current content and stored check result. */
export async function reconcileNarrationWithDocument(
  userId: string,
  documentId: string,
): Promise<void> {
  const document = await readNarrationDocument(userId, documentId);
  if (!isDocumentReadyForNarration(document)) return;
  const source = await loadNarrationSource(userId, documentId, document);
  if (!isNarratabilityCurrent(document.narratability, source.contentHash))
    return;
  await reconcileNarration(userId, documentId, source, document.narratability);
}

export interface IJudgeDocumentNarratabilityResult {
  narratability?: DocumentNarratability;
  /** False when the stored result was already current and nothing ran. */
  judged: boolean;
  /** Another request is checking this content; its result lands on the document. */
  pending?: boolean;
}

export interface IJudgeDocumentNarratabilityParams {
  userId: string;
  documentId: string;
  /** The document record as written, when the caller already has it. */
  documentData?: Record<string, unknown>;
  /** Runs just before the decision model is asked, e.g. a rate limit. */
  beforeDecision?: () => Promise<void>;
}

/** A document edited while it was judged is judged again, at most this often. */
const JUDGE_ATTEMPTS = 2;

/**
 * Stores a result only if the document is still the revision it was made
 * from. Returns 'stale' when the content changed meanwhile.
 */
async function storeNarratability(
  userId: string,
  documentId: string,
  judgedData: Record<string, unknown>,
  narratability: DocumentNarratability,
): Promise<'stored' | 'stale' | 'gone'> {
  const documentRef = FirestorePaths.document(userId, documentId);
  return getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentRef);
    const current = snapshot.data();
    if (!snapshot.exists || !current) return 'gone';
    if (narrationContentFieldsChanged(judgedData, current)) return 'stale';
    transaction.update(documentRef, { narratability });
    return 'stored';
  });
}

/**
 * Runs the narratable check when the document's spoken text has no current
 * result, stores the result on the document, and reconciles its narration.
 * A result is stored and reconciled only for the revision it was made from.
 */
export async function judgeDocumentNarratability(
  params: IJudgeDocumentNarratabilityParams,
): Promise<IJudgeDocumentNarratabilityResult> {
  const { userId, documentId } = params;
  let given = params.documentData;
  for (let attempt = 1; attempt <= JUDGE_ATTEMPTS; attempt += 1) {
    const data = given ?? (await readNarrationDocumentData(userId, documentId));
    given = undefined;
    const document = readNarrationDocumentFields(data);
    if (!isDocumentReadyForNarration(document)) {
      return { narratability: undefined, judged: false };
    }

    const source = await loadNarrationSource(userId, documentId, document);
    if (isNarratabilityCurrent(document.narratability, source.contentHash)) {
      let current = document.narratability;
      // Same spoken text under newer rules: record the rules so the reader
      // stops asking again (ADR 020). Nothing is judged.
      if (current.scriptVersion !== source.script.scriptVersion) {
        const stamped = {
          ...current,
          scriptVersion: source.script.scriptVersion,
        };
        if (
          (await storeNarratability(userId, documentId, data, stamped)) ===
          'stored'
        ) {
          current = stamped;
        }
      }
      await reconcileIfBehind(userId, documentId, source, current);
      return { narratability: current, judged: false };
    }

    const { outcome, lease } = await judge(
      userId,
      documentId,
      source,
      params.beforeDecision,
    );
    if (outcome.kind === 'pending') {
      return { narratability: undefined, judged: false, pending: true };
    }
    if (outcome.kind === 'unanswered') {
      return { narratability: undefined, judged: true };
    }

    const { narratability } = outcome;
    let stored: 'stored' | 'stale' | 'gone';
    try {
      stored = await storeNarratability(
        userId,
        documentId,
        data,
        narratability,
      );
    } finally {
      if (lease) await releaseCheckLease(lease);
    }
    if (stored === 'gone') {
      logger.warn('Narratable check result not stored: document gone', {
        userId,
        documentId,
      });
      return { narratability, judged: true };
    }
    if (stored === 'stale') {
      // Edited while it was judged: an older result must not replace a newer one.
      logger.info('Narratable check result discarded: document changed', {
        userId,
        documentId,
        attempt,
      });
      continue;
    }

    await reconcileNarration(userId, documentId, source, narratability);
    logger.info('Narratable check stored', {
      userId,
      documentId,
      status: narratability.status,
      reason: narratability.reason,
      probability: narratability.probability,
      spokenCharCount: narratability.spokenCharCount,
    });
    return { narratability, judged: true };
  }
  // Still changing; the trigger for its latest write judges it.
  return { narratability: undefined, judged: true };
}
