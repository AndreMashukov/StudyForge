import { getFirestore } from 'firebase-admin/firestore';
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
  readNarrationDocument,
  type INarrationDocumentFields,
  type INarrationSource,
} from './narration-source';
import {
  deleteNarrationPartAudio,
  narrationRecordRef,
  parseStoredNarrationRecord,
  removeNarration,
} from './narration-store';
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

async function judge(
  userId: string,
  source: INarrationSource,
): Promise<DocumentNarratability | undefined> {
  const base = {
    spokenCharCount: source.script.spokenCharCount,
    contentHash: source.contentHash,
    schemaVersion: NARRATION_SCHEMA_VERSION,
    checkedAt: new Date().toISOString(),
  };
  const screen = screenNarrationScript(source.script);
  if (screen.outcome === 'notNarratable') {
    return { ...base, status: 'notNarratable', reason: screen.reason };
  }

  try {
    const decision = await evaluateDocumentNarratable({
      userId,
      proseSample: sampleNarrationProse(source.script),
    });
    return decision.narratable
      ? { ...base, status: 'narratable', probability: decision.probability }
      : {
          ...base,
          status: 'notNarratable',
          reason: 'notSuitable',
          probability: decision.probability,
        };
  } catch (error) {
    // Unanswered is not "no": the document stays unjudged and is judged again later.
    logger.warn('Narratable check could not be answered', {
      userId,
      message: error instanceof Error ? error.message : String(error),
    });
    return undefined;
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
  const dropped = await getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return [];
    const record = parseStoredNarrationRecord(snapshot.data());
    if (!record || record.contentHash === source.contentHash || record.runId) {
      // A running generation reconciles when it finishes.
      return [];
    }
    const { kept, dropped: removed } = remapNarrationParts(
      record.parts,
      keyNarrationParts(source.plan, record.voice, record.model),
    );
    transaction.update(ref, {
      parts: kept,
      contentHash: source.contentHash,
      status: kept.length ? summarizeNarrationStatus(kept) : 'failed',
      updatedAt: new Date().toISOString(),
    });
    return removed;
  });
  if (dropped.length) {
    await deleteNarrationPartAudio(userId, dropped);
    logger.info('Stale narration parts removed', {
      userId,
      documentId,
      removedParts: dropped.length,
    });
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
}

/**
 * Runs the narratable check when the document's spoken text has no current
 * result, stores the result on the document, and reconciles its narration.
 */
export async function judgeDocumentNarratability(params: {
  userId: string;
  documentId: string;
  document?: INarrationDocumentFields;
}): Promise<IJudgeDocumentNarratabilityResult> {
  const { userId, documentId } = params;
  const document =
    params.document ?? (await readNarrationDocument(userId, documentId));
  if (!isDocumentReadyForNarration(document)) {
    return { narratability: undefined, judged: false };
  }

  const source = await loadNarrationSource(userId, documentId, document);
  if (isNarratabilityCurrent(document.narratability, source.contentHash)) {
    return { narratability: document.narratability, judged: false };
  }

  const narratability = await judge(userId, source);
  if (!narratability) {
    return { narratability: undefined, judged: true };
  }

  const documentRef = FirestorePaths.document(userId, documentId);
  try {
    await documentRef.update({ narratability });
  } catch (error) {
    logger.warn('Narratable check result not stored (document gone?)', {
      userId,
      documentId,
      message: error instanceof Error ? error.message : String(error),
    });
    return { narratability, judged: true };
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
