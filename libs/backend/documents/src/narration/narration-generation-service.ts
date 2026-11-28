import { randomUUID } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import {
  NARRATION_AUDIO_BITRATE_KBPS,
  NARRATION_AUDIO_CONTENT_TYPE,
  NARRATION_CHARS_PER_SECOND,
  NARRATION_SCHEMA_VERSION,
  narrationScriptVersionFor,
  summarizeNarrationStatus,
  type NarrationPart,
  type NarrationQuote,
  type NarrationUnavailableReason,
} from '@shared-types';
import {
  refundUsageReservation,
  reserveUsageCredits,
  resolveUserUsageLimitsContext,
} from '@study-forge/backend-core/services/usage-limits-service';
import {
  releaseUserStorageReservation,
  reserveUserStorageBytes,
} from '@study-forge/backend-core/services/usage-quota-service';
import {
  buildProviderCostContext,
  runWithProviderCostContext,
} from '@study-forge/backend-core/services/provider-cost';
import {
  resolveNarrationSpeechRoute,
  synthesizeSpeech,
  type ISpeechRoute,
} from '@study-forge/backend-llm/llm/gemini-speech-client';
import {
  encodeMp3,
  mp3DurationMs,
  pcmDurationMs,
} from '@study-forge/backend-llm/llm/speech-audio';
import { DocumentService } from '../document-storage';
import {
  isNarratabilityCurrent,
  reconcileNarrationWithDocument,
} from './narratability-service';
import {
  keyNarrationParts,
  planNarrationWork,
  type IKeyedNarrationPart,
  type INarrationWork,
} from './narration-planning';
import {
  listStaleOpenNarrationRunIds,
  NARRATION_RUN_STALE_MS,
  narrationRunRef,
  narrationRunTallyUpdate,
  parseNarrationRun,
  settleNarrationRun,
  takeStaleNarrationRun,
  trackNarrationRunUpload,
} from './narration-runs';
import {
  isDocumentReadyForNarration,
  loadNarrationSource,
  readNarrationDocument,
  type INarrationSource,
} from './narration-source';
import {
  processNarrationAudioDeletionSoon,
  queueNarrationAudioDeletion,
  sweepNarrationAudioDeletions,
} from './narration-audio-deletions';
import {
  cleanNarrationPart,
  narrationPartStoragePath,
  narrationRecordRef,
  parseStoredNarrationRecord,
  readNarrationRecord,
  type StoredNarrationRecord,
} from './narration-store';
import {
  enqueueNarrationRunTask,
  type INarrationRunTaskPayload,
} from './narration-task-queue';

/** Parts generated at the same time within one run. */
const PART_CONCURRENCY = 3;
/** Attempts per part before it is marked failed. */
const PART_ATTEMPTS = 2;
/** Attempts to publish an uploaded part as ready before it is marked failed. */
const PUBLISH_ATTEMPTS = 3;
/** Longest wait for one speech request. */
const SPEECH_REQUEST_TIMEOUT_MS = 90_000;
/**
 * Stop starting parts after this long. A part started just before it can take
 * PART_ATTEMPTS × SPEECH_REQUEST_TIMEOUT_MS plus encoding and upload, which
 * must still end inside the task's 540s timeout.
 */
const RUN_SOFT_DEADLINE_MS = 330_000;

const BYTES_PER_SECOND = (NARRATION_AUDIO_BITRATE_KBPS * 1000) / 8;

/** Storage held before a run, from the expected spoken length plus a margin. */
function estimateStorageBytes(charCount: number): number {
  return Math.ceil(
    (charCount / NARRATION_CHARS_PER_SECOND) * BYTES_PER_SECOND * 1.25,
  );
}

export class NarrationUnavailableError extends Error {
  constructor(readonly reason: NarrationUnavailableReason) {
    super(`Narration is not available: ${reason}`);
    this.name = 'NarrationUnavailableError';
  }
}

export class NarrationPriceChangedError extends Error {
  constructor(readonly credits: number) {
    super('The narration price changed. Check the new price and try again.');
    this.name = 'NarrationPriceChangedError';
  }
}

function isRunStale(record: StoredNarrationRecord, now = Date.now()): boolean {
  if (!record.runId) return false;
  const started = Date.parse(record.runStartedAt ?? record.updatedAt);
  return !Number.isFinite(started) || now - started > NARRATION_RUN_STALE_MS;
}

function failUnfinishedParts(
  parts: NarrationPart[],
  errorMessage: string,
): NarrationPart[] {
  return parts.map((part) =>
    part.status === 'pending' || part.status === 'generating'
      ? cleanNarrationPart({ ...part, status: 'failed', errorMessage })
      : part,
  );
}

/**
 * Releases the narration from a run: fails the parts it did not reach and
 * removes its run id, but only while that run still owns the narration.
 */
async function releaseNarrationFromRun(
  userId: string,
  documentId: string,
  runId: string,
  errorMessage: string,
): Promise<StoredNarrationRecord | null> {
  const ref = narrationRecordRef(userId, documentId);
  return getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const record = snapshot.exists
      ? parseStoredNarrationRecord(snapshot.data())
      : null;
    if (!record || record.runId !== runId) return null;
    const parts = failUnfinishedParts(record.parts, errorMessage);
    transaction.update(ref, {
      parts,
      status: summarizeNarrationStatus(parts),
      runId: FieldValue.delete(),
      runStartedAt: FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    });
    return { ...record, parts };
  });
}

export interface IAbandonNarrationRunParams {
  userId: string;
  documentId: string;
  runId: string;
  errorMessage: string;
}

/**
 * Ends a run whose worker is gone (or never started): frees the narration,
 * settles what the run reserved, then applies any document edit that waited
 * for the run (a replacement run is left alone). Safe to call more than once.
 */
export async function abandonNarrationRun(
  params: IAbandonNarrationRunParams,
): Promise<void> {
  await releaseNarrationFromRun(
    params.userId,
    params.documentId,
    params.runId,
    params.errorMessage,
  );
  await settleNarrationRun(params.runId);
  await reconcileAfterRun(params.userId, params.documentId);
}

/**
 * Abandons a run found stale, unless its worker claimed it meanwhile. Returns
 * false when the run is alive after all.
 */
async function abandonStaleNarrationRun(
  params: IAbandonNarrationRunParams,
): Promise<boolean> {
  const take = await takeStaleNarrationRun(params.runId);
  if (take.kind === 'active') return false;
  // A missing run was settled already; the narration may still name it.
  await abandonNarrationRun(params);
  return true;
}

interface IPreparedNarration {
  source: INarrationSource;
  route: ISpeechRoute;
  record: StoredNarrationRecord | null;
  work: INarrationWork;
  creditCostPerUnit: number;
  quote: NarrationQuote;
}

function unavailable(reason: NarrationUnavailableReason): NarrationQuote {
  return {
    available: false,
    unavailableReason: reason,
    totalParts: 0,
    partsToGenerate: 0,
    chargedCharCount: 0,
    credits: 0,
    voiceChanged: false,
  };
}

async function prepareNarration(
  userId: string,
  documentId: string,
): Promise<IPreparedNarration | NarrationQuote> {
  const context = await resolveUserUsageLimitsContext(userId);
  const policy = context.setup.featurePolicies.documentNarration;
  if (!policy?.enabled) return unavailable('featureDisabled');

  let record = await readNarrationRecord(userId, documentId);
  const source = await loadNarrationSource(
    userId,
    documentId,
    undefined,
    narrationScriptVersionFor(record),
  );
  if (!isDocumentReadyForNarration(source.document))
    return unavailable('documentNotReady');
  if (
    !isNarratabilityCurrent(source.document.narratability, source.contentHash)
  ) {
    return unavailable('unjudged');
  }
  if (source.document.narratability.status !== 'narratable')
    return unavailable('notNarratable');

  if (record?.runId && isRunStale(record)) {
    const abandoned = await abandonStaleNarrationRun({
      userId,
      documentId,
      runId: record.runId,
      errorMessage: 'Generation stopped; try again',
    });
    if (abandoned) record = await readNarrationRecord(userId, documentId);
  }
  if (record?.runId) return unavailable('generating');

  const route = await resolveNarrationSpeechRoute(userId);
  const planned = keyNarrationParts(source.plan, route.voice, route.model);
  const work = planNarrationWork(planned, record, route);
  const creditCostPerUnit = Math.max(0, policy.creditCost);
  return {
    source,
    route,
    record,
    work,
    creditCostPerUnit,
    quote: {
      available: true,
      totalParts: work.parts.length,
      partsToGenerate: work.toGenerate.length,
      chargedCharCount: work.chargedCharCount,
      credits: work.creditUnits * creditCostPerUnit,
      voiceChanged: work.voiceChanged,
    },
  };
}

function isQuote(
  value: IPreparedNarration | NarrationQuote,
): value is NarrationQuote {
  return 'available' in value;
}

/** The price of narrating what is missing, shown before the learner confirms. */
export async function quoteDocumentNarration(
  userId: string,
  documentId: string,
): Promise<NarrationQuote> {
  const prepared = await prepareNarration(userId, documentId);
  return isQuote(prepared) ? prepared : prepared.quote;
}

export interface IStartDocumentNarrationResult {
  status: 'started' | 'alreadyRunning' | 'nothingToGenerate';
  credits: number;
}

export interface IStartDocumentNarrationParams {
  /** The authenticated learner; never taken from the request body. */
  userId: string;
  documentId: string;
  /** The price the learner confirmed. */
  expectedCredits: number;
}

/** What the start transaction found when it re-planned against the record. */
type StartTransactionOutcome =
  | { kind: 'started'; obsoleteDeletionId: string | null }
  | { kind: 'alreadyRunning' }
  | { kind: 'nothingToGenerate' }
  /** The work grew past what was reserved; the new price is shown instead. */
  | { kind: 'priceChanged'; credits: number };

interface IHeldReservations {
  userId: string;
  reservationId?: string;
  reservedStorageBytes: number;
}

/**
 * Gives back what a start held when no run was created. Each hold is released
 * on its own, so a failed credit refund still frees the storage. A failure is
 * logged with what it held, for follow-up.
 */
async function releaseHeldReservations(held: IHeldReservations): Promise<void> {
  const [credits, storage] = await Promise.allSettled([
    held.reservationId
      ? refundUsageReservation(held.userId, held.reservationId)
      : Promise.resolve(),
    releaseUserStorageReservation({
      userId: held.userId,
      reservedBytes: held.reservedStorageBytes,
    }),
  ]);
  for (const [hold, result] of [
    ['credits', credits],
    ['storage', storage],
  ] as const) {
    if (result.status === 'rejected') {
      logger.error('Narration start could not give back a hold', {
        userId: held.userId,
        hold,
        reservationId: held.reservationId,
        reservedStorageBytes: held.reservedStorageBytes,
        message:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    }
  }
}

/**
 * Reserves credits and storage for the missing parts, records the plan and
 * the run, and queues the run. Refused when the price differs from what the
 * learner saw, at the quote, at the reservation, or when re-planned.
 */
export async function startDocumentNarration(
  params: IStartDocumentNarrationParams,
): Promise<IStartDocumentNarrationResult> {
  const { userId, documentId } = params;
  const prepared = await prepareNarration(userId, documentId);
  if (isQuote(prepared)) {
    if (prepared.unavailableReason === 'generating') {
      return { status: 'alreadyRunning', credits: 0 };
    }
    throw new NarrationUnavailableError(
      prepared.unavailableReason ?? 'notNarratable',
    );
  }
  const { work, quote, route, source, creditCostPerUnit } = prepared;
  if (quote.credits !== params.expectedCredits) {
    throw new NarrationPriceChangedError(quote.credits);
  }
  if (!work.toGenerate.length) {
    return { status: 'nothingToGenerate', credits: 0 };
  }

  const held: IHeldReservations = {
    userId,
    reservedStorageBytes: estimateStorageBytes(work.chargedCharCount),
  };
  await reserveUserStorageBytes(userId, held.reservedStorageBytes);
  try {
    if (quote.credits > 0) {
      const reservation = await reserveUsageCredits({
        userId,
        generationKind: 'documentNarration',
        quantity: work.creditUnits,
      });
      held.reservationId = reservation.id;
      // The price can change between the quote and the hold.
      if (reservation.credits !== params.expectedCredits) {
        throw new NarrationPriceChangedError(reservation.credits);
      }
    }
  } catch (error) {
    await releaseHeldReservations(held);
    throw error;
  }

  const runId = randomUUID();
  const now = new Date().toISOString();
  const recordRef = narrationRecordRef(userId, documentId);
  let outcome: StartTransactionOutcome;
  try {
    outcome = await getFirestore().runTransaction(
      async (transaction): Promise<StartTransactionOutcome> => {
        const snapshot = await transaction.get(recordRef);
        const current = snapshot.exists
          ? parseStoredNarrationRecord(snapshot.data())
          : null;
        if (current?.runId) return { kind: 'alreadyRunning' };
        // Re-plan against the record as it is now, so a part finished meanwhile is not redone.
        const fresh = planNarrationWork(
          keyNarrationParts(source.plan, route.voice, route.model),
          current,
          route,
        );
        if (!fresh.toGenerate.length) return { kind: 'nothingToGenerate' };
        // A part removed meanwhile adds work the holds do not cover.
        if (
          fresh.creditUnits > work.creditUnits ||
          estimateStorageBytes(fresh.chargedCharCount) >
            held.reservedStorageBytes
        ) {
          return {
            kind: 'priceChanged',
            credits: fresh.creditUnits * creditCostPerUnit,
          };
        }
        transaction.set(recordRef, {
          documentId,
          schemaVersion: NARRATION_SCHEMA_VERSION,
          // The rules the plan was made with; the narration keeps them (ADR 020).
          scriptVersion: source.script.scriptVersion,
          model: route.model,
          voice: route.voice,
          contentHash: source.contentHash,
          status: 'generating',
          parts: fresh.parts.map(cleanNarrationPart),
          runId,
          runStartedAt: now,
          updatedAt: now,
        });
        transaction.set(narrationRunRef(runId), {
          userId,
          documentId,
          ...(held.reservationId ? { reservationId: held.reservationId } : {}),
          reservedStorageBytes: held.reservedStorageBytes,
          creditCostPerUnit,
          generatedCharCount: 0,
          storedBytes: 0,
          status: 'open',
          startedAt: now,
        });
        return {
          kind: 'started',
          // Audio of parts the plan no longer has goes in the same write.
          obsoleteDeletionId: queueNarrationAudioDeletion(
            transaction,
            userId,
            documentId,
            fresh.obsolete,
          ),
        };
      },
    );
  } catch (error) {
    // No run exists yet, so nothing else would give these back.
    await releaseHeldReservations(held);
    throw error;
  }

  if (outcome.kind !== 'started') {
    await releaseHeldReservations(held);
    if (outcome.kind === 'priceChanged') {
      throw new NarrationPriceChangedError(outcome.credits);
    }
    return { status: outcome.kind, credits: 0 };
  }

  const payload: INarrationRunTaskPayload = { userId, documentId, runId };
  try {
    await enqueueNarrationRunTask(payload);
  } catch (error) {
    logger.error('Narration run could not be queued', {
      userId,
      documentId,
      runId,
      message: error instanceof Error ? error.message : String(error),
    });
    // If the task was created after all, its worker finds the run settled and stops.
    await abandonNarrationRun({
      userId,
      documentId,
      runId,
      errorMessage: 'Could not start',
    });
    throw error;
  }
  // After the run is queued, so a failed delete never keeps it from starting.
  await processNarrationAudioDeletionSoon(outcome.obsoleteDeletionId);

  logger.info('Narration run started', {
    userId,
    documentId,
    runId,
    parts: work.toGenerate.length,
    chargedCharCount: work.chargedCharCount,
    credits: quote.credits,
  });
  return { status: 'started', credits: quote.credits };
}

/**
 * Claims a run for one worker. Cloud Tasks may deliver a task twice, and a
 * run that was already settled must not start.
 */
async function claimNarrationRun(
  payload: INarrationRunTaskPayload,
): Promise<boolean> {
  const ref = narrationRunRef(payload.runId);
  const recordRef = narrationRecordRef(payload.userId, payload.documentId);
  return getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const recordSnapshot = await transaction.get(recordRef);
    if (!snapshot.exists || !parseNarrationRun(snapshot.data())) return false;
    if (snapshot.get('claimedAt')) return false;
    // Time spent waiting in the task queue does not count towards staleness.
    const now = new Date().toISOString();
    transaction.update(ref, { claimedAt: now, startedAt: now });
    const record = recordSnapshot.exists
      ? parseStoredNarrationRecord(recordSnapshot.data())
      : null;
    if (record?.runId === payload.runId) {
      transaction.update(recordRef, { runStartedAt: now });
    }
    return true;
  });
}

/**
 * Updates every part with this key, only while the run still owns the
 * narration. When a key first becomes ready, the run's tallies grow by one
 * part's text and file, even if repeated text gives several parts that key.
 */
async function updatePart(
  payload: INarrationRunTaskPayload,
  key: string,
  patch: Partial<NarrationPart>,
): Promise<boolean> {
  const ref = narrationRecordRef(payload.userId, payload.documentId);
  return getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const record = snapshot.exists
      ? parseStoredNarrationRecord(snapshot.data())
      : null;
    if (!record || record.runId !== payload.runId) return false;
    const target = record.parts.find((part) => part.key === key);
    // A ready update that committed but reported an error is never undone.
    if (target?.status === 'ready' && patch.status !== 'ready') return true;
    const parts = record.parts.map((part) =>
      part.key === key ? cleanNarrationPart({ ...part, ...patch }) : part,
    );
    transaction.update(ref, { parts, updatedAt: new Date().toISOString() });
    if (patch.status === 'ready' && target && target.status !== 'ready') {
      transaction.update(
        narrationRunRef(payload.runId),
        narrationRunTallyUpdate(target.charCount, patch.sizeBytes ?? 0),
      );
    }
    return true;
  });
}

interface IUploadedPartAudio {
  durationMs: number;
  sizeBytes: number;
}

/**
 * Narrates one part and uploads its audio. The file is recorded on the run
 * first, so settling the run deletes it if it is never published.
 */
async function synthesizePartAudio(
  payload: INarrationRunTaskPayload,
  route: ISpeechRoute,
  part: IKeyedNarrationPart,
  storagePath: string,
): Promise<IUploadedPartAudio> {
  const pcm = await synthesizeSpeech(
    route,
    part.text,
    SPEECH_REQUEST_TIMEOUT_MS,
  );
  const mp3 = encodeMp3(pcm, NARRATION_AUDIO_BITRATE_KBPS);
  await trackNarrationRunUpload(payload.runId, storagePath);
  await DocumentService.getBucket()
    .file(storagePath)
    .save(Buffer.from(mp3), {
      resumable: false,
      contentType: NARRATION_AUDIO_CONTENT_TYPE,
      metadata: { cacheControl: 'private, max-age=31536000, immutable' },
    });
  // What the encoded file plays, padding included, so positions in the joined
  // audio map to the right part.
  return {
    durationMs: mp3DurationMs(mp3) || pcmDurationMs(pcm),
    sizeBytes: mp3.length,
  };
}

function logPartFailure(
  payload: INarrationRunTaskPayload,
  part: IKeyedNarrationPart,
  step: 'synthesize' | 'publish',
  attempt: number,
  error: unknown,
): void {
  logger.warn('Narration part attempt failed', {
    userId: payload.userId,
    documentId: payload.documentId,
    partIndex: part.index,
    step,
    attempt,
    message: error instanceof Error ? error.message : String(error),
  });
}

/**
 * Generates one part: narrates and uploads it, then publishes it as ready.
 * Publishing is retried on its own, without narrating again. A file that is
 * never published is deleted when the run settles. Returns false when the run
 * no longer owns the narration.
 */
async function generatePart(
  payload: INarrationRunTaskPayload,
  route: ISpeechRoute,
  part: IKeyedNarrationPart,
): Promise<boolean> {
  // The run id in the name keeps a superseded run from touching a newer run's file.
  const storagePath = narrationPartStoragePath(
    payload.userId,
    payload.documentId,
    `${part.key}-${payload.runId.slice(0, 8)}`,
  );
  let lastError: unknown;
  let audio: IUploadedPartAudio | null = null;
  for (let attempt = 1; attempt <= PART_ATTEMPTS && !audio; attempt += 1) {
    try {
      audio = await synthesizePartAudio(payload, route, part, storagePath);
    } catch (error) {
      lastError = error;
      logPartFailure(payload, part, 'synthesize', attempt, error);
    }
  }

  if (audio) {
    for (let attempt = 1; attempt <= PUBLISH_ATTEMPTS; attempt += 1) {
      try {
        const owned = await updatePart(payload, part.key, {
          status: 'ready',
          storagePath,
          durationMs: audio.durationMs,
          sizeBytes: audio.sizeBytes,
          errorMessage: undefined,
        });
        if (!owned) {
          // The narration was removed or taken over while this part was generating.
          await DocumentService.getBucket()
            .file(storagePath)
            .delete({ ignoreNotFound: true })
            .catch(() => undefined);
        }
        return owned;
      } catch (error) {
        lastError = error;
        logPartFailure(payload, part, 'publish', attempt, error);
      }
    }
  }
  return updatePart(payload, part.key, {
    status: 'failed',
    errorMessage:
      lastError instanceof Error
        ? lastError.message.slice(0, 300)
        : 'Speech generation failed',
  });
}

/** Generates the pending parts of one narration run (Cloud Task worker). */
export async function runNarrationTask(
  payload: INarrationRunTaskPayload,
): Promise<void> {
  const startedAt = Date.now();
  const { userId, documentId, runId } = payload;
  if (!(await claimNarrationRun(payload))) {
    logger.info('Narration run already claimed or settled', payload);
    return;
  }

  try {
    const record = await readNarrationRecord(userId, documentId);
    if (record && record.runId === runId) {
      const [route, source] = await Promise.all([
        resolveNarrationSpeechRoute(userId),
        loadNarrationSource(
          userId,
          documentId,
          undefined,
          narrationScriptVersionFor(record),
        ),
      ]);
      const byKey = new Map(
        keyNarrationParts(source.plan, route.voice, route.model).map((part) => [
          part.key,
          part,
        ]),
      );
      const queued = new Set<string>();
      const queue = record.parts
        .filter(
          (part) => part.status === 'pending' || part.status === 'generating',
        )
        .map((part) => byKey.get(part.key))
        .filter((part): part is IKeyedNarrationPart => {
          // Repeated text shares one key and one audio file.
          if (!part || queued.has(part.key)) return false;
          queued.add(part.key);
          return true;
        });

      const costContext = buildProviderCostContext({
        userId,
        generationKind: 'documentNarration',
        recordId: documentId,
      });
      let owned = true;
      // A worker that fails stops new parts from being taken, but the parts
      // other workers are generating finish before the run is released.
      let workerError: unknown = null;
      await runWithProviderCostContext(costContext, async () => {
        const worker = async () => {
          for (;;) {
            if (
              !owned ||
              workerError !== null ||
              Date.now() - startedAt > RUN_SOFT_DEADLINE_MS
            ) {
              return;
            }
            const part = queue.shift();
            if (!part) return;
            try {
              if (
                !(await updatePart(payload, part.key, {
                  status: 'generating',
                }))
              ) {
                owned = false;
                return;
              }
              if (!(await generatePart(payload, route, part))) owned = false;
            } catch (error) {
              workerError ??= error;
              return;
            }
          }
        };
        await Promise.all(Array.from({ length: PART_CONCURRENCY }, worker));
      });
      if (workerError !== null) throw workerError;
    } else {
      logger.info('Narration run superseded before it started', payload);
    }
  } catch (error) {
    logger.error('Narration run failed', {
      ...payload,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  await releaseNarrationFromRun(
    userId,
    documentId,
    runId,
    'Not narrated in time; try again',
  );
  await settleNarrationRun(runId);
  await reconcileAfterRun(userId, documentId);
  logger.info('Narration run finished', {
    ...payload,
    durationMs: Date.now() - startedAt,
  });
}

/** An edit made while the run was generating is reconciled once the run ends. */
async function reconcileAfterRun(
  userId: string,
  documentId: string,
): Promise<void> {
  try {
    const [document, record] = await Promise.all([
      readNarrationDocument(userId, documentId),
      readNarrationRecord(userId, documentId),
    ]);
    if (!record || record.runId) return;
    if (
      document.narratability &&
      document.narratability.contentHash !== record.contentHash
    ) {
      await reconcileNarrationWithDocument(userId, documentId);
    }
  } catch (error) {
    logger.warn('Narration reconcile after run failed', {
      userId,
      documentId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Settles narration runs whose worker died or never started, so their
 * credits and storage are never held for good. Returns how many it settled.
 */
export async function sweepStaleNarrationRuns(): Promise<number> {
  const runIds = await listStaleOpenNarrationRunIds();
  let settled = 0;
  for (const runId of runIds) {
    try {
      // Re-checked in a transaction: a worker may have claimed it since it was listed.
      const take = await takeStaleNarrationRun(runId);
      if (take.kind !== 'taken') continue;
      await abandonNarrationRun({
        userId: take.run.userId,
        documentId: take.run.documentId,
        runId,
        errorMessage: 'Generation stopped; try again',
      });
      settled += 1;
    } catch (error) {
      logger.error('Stale narration run could not be settled', {
        runId,
        message: error instanceof Error ? error.message : String(error),
      });
      // Move it to the back of the queue, so one run that keeps failing never blocks the sweep.
      await narrationRunRef(runId)
        .update({
          startedAt: new Date().toISOString(),
          sweepFailures: FieldValue.increment(1),
        })
        .catch(() => undefined);
    }
  }
  if (settled) logger.warn('Stale narration runs settled', { settled });
  const deletions = await sweepNarrationAudioDeletions();
  if (deletions) {
    logger.warn('Pending narration audio deletions finished', { deletions });
  }
  return settled;
}
