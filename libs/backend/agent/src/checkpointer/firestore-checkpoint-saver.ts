import {
  BaseCheckpointSaver,
  WRITES_IDX_MAP,
  copyCheckpoint,
  getCheckpointId,
  type ChannelVersions,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointMetadata,
  type CheckpointTuple,
  type PendingWrite,
} from '@langchain/langgraph-checkpoint';
import type { RunnableConfig } from '@langchain/core/runnables';
import { Timestamp } from 'firebase-admin/firestore';
import type { AgentActionResult, AgentProposedDelete } from '@shared-types';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { computeExpiresAt } from '@study-forge/backend-core/lib/firestore-ttl';
import {
  agentCheckpointCollection,
  agentCheckpointChannelValuesCollection,
  agentCheckpointTurnRef,
} from './firestore-checkpoint-paths';

const MAX_INLINE_BYTES = 800_000;
const FIRESTORE_BATCH_LIMIT = 400;

export interface IParsedWritesDocId {
  taskId: string;
  idx: number;
}

export class CheckpointOverflowUnavailableError extends Error {
  constructor() {
    super('Workspace agent checkpoint overflow data is missing');
    this.name = 'CheckpointOverflowUnavailableError';
  }
}

export class CheckpointSerializationTooLargeError extends Error {
  constructor(byteLength: number) {
    super(
      `Workspace agent checkpoint channel values exceed ${MAX_INLINE_BYTES} bytes (${byteLength})`,
    );
    this.name = 'CheckpointSerializationTooLargeError';
  }
}

const serializedBytesSchema = z.custom<Uint8Array | string>((value) => {
  return toSerdeBytes(value) !== null;
});

const checkpointRecordSchema = z.object({
  checkpoint: serializedBytesSchema,
  metadata: serializedBytesSchema,
  overflowRef: z.string().min(1).nullable().optional(),
  parentCheckpointId: z.string().min(1).nullable().optional(),
});

const overflowRecordSchema = z.object({
  channelValues: serializedBytesSchema,
});

const pendingWriteRecordSchema = z.object({
  channel: z.string().min(1),
  value: serializedBytesSchema,
  taskId: z.string().min(1).optional(),
});

export type ICheckpointRecord = z.infer<typeof checkpointRecordSchema>;
export type IOverflowRecord = z.infer<typeof overflowRecordSchema>;
export type IPendingWriteRecord = z.infer<typeof pendingWriteRecordSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseCompletedActions(value: unknown): AgentActionResult[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is AgentActionResult => {
    return (
      isRecord(entry) &&
      typeof entry.kind === 'string' &&
      typeof entry.summary === 'string'
    );
  });
}

function parseCompletedDeletes(value: unknown): AgentProposedDelete[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is AgentProposedDelete => {
    return (
      isRecord(entry) &&
      typeof entry.targetType === 'string' &&
      typeof entry.targetId === 'string' &&
      typeof entry.label === 'string'
    );
  });
}

export function toSerdeBytes(value: unknown): Uint8Array | string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return new Uint8Array(value);
  }
  if (
    isRecord(value) &&
    typeof value.toUint8Array === 'function'
  ) {
    const bytes = value.toUint8Array();
    return bytes instanceof Uint8Array ? bytes : null;
  }
  return null;
}

function isCheckpoint(value: unknown): value is Checkpoint {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'string' && typeof value.v === 'number';
}

function isCheckpointMetadata(value: unknown): value is CheckpointMetadata {
  return isRecord(value);
}

export function applyOverflowChannelValues(
  checkpoint: Checkpoint,
  overflowChannelValues: unknown,
): Checkpoint {
  if (!isRecord(overflowChannelValues)) {
    throw new CheckpointOverflowUnavailableError();
  }
  checkpoint.channel_values = overflowChannelValues;
  return checkpoint;
}

function writesDocId(taskId: string, idx: number): string {
  return `${taskId}__${idx}`;
}

function parseWritesDocId(docId: string): IParsedWritesDocId {
  const separator = docId.lastIndexOf('__');
  if (separator <= 0) {
    return { taskId: docId, idx: 0 };
  }
  return {
    taskId: docId.slice(0, separator),
    idx: Number.parseInt(docId.slice(separator + 2), 10) || 0,
  };
}

export class FirestoreCheckpointSaver extends BaseCheckpointSaver {
  private resolveUserId(config: RunnableConfig): string {
    const userId = config.configurable?.userId;
    if (typeof userId !== 'string' || userId.length === 0) {
      throw new Error('FirestoreCheckpointSaver requires configurable.userId');
    }
    return userId;
  }

  private resolveThreadId(config: RunnableConfig): string {
    const threadId = config.configurable?.thread_id;
    if (typeof threadId !== 'string' || threadId.length === 0) {
      throw new Error(
        'FirestoreCheckpointSaver requires configurable.thread_id',
      );
    }
    return threadId;
  }

  private checkpointNamespace(config: RunnableConfig): string {
    const checkpointNs = config.configurable?.checkpoint_ns;
    return typeof checkpointNs === 'string' ? checkpointNs : '';
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const userId = this.resolveUserId(config);
    const threadId = this.resolveThreadId(config);
    const checkpointNamespace = this.checkpointNamespace(config);
    let checkpointId = getCheckpointId(config);
    const collection = agentCheckpointCollection(userId, threadId);

    if (!checkpointId) {
      const latest = await collection
        .where('checkpointNamespace', '==', checkpointNamespace)
        .orderBy('checkpointId', 'desc')
        .limit(1)
        .get();
      if (latest.empty) {
        return undefined;
      }
      checkpointId = latest.docs[0].id;
    }

    const doc = await collection.doc(checkpointId).get();
    if (!doc.exists) {
      return undefined;
    }

    const parsedRecord = checkpointRecordSchema.safeParse(doc.data());
    if (!parsedRecord.success) {
      throw new Error('Workspace agent checkpoint record is invalid');
    }

    const checkpointBytes = toSerdeBytes(parsedRecord.data.checkpoint);
    const metadataBytes = toSerdeBytes(parsedRecord.data.metadata);
    if (!checkpointBytes || !metadataBytes) {
      throw new Error('Workspace agent checkpoint record is invalid');
    }

    const loadedCheckpoint: unknown = await this.serde.loadsTyped(
      'json',
      checkpointBytes,
    );
    if (!isCheckpoint(loadedCheckpoint)) {
      throw new Error('Workspace agent checkpoint payload is invalid');
    }

    if (parsedRecord.data.overflowRef) {
      const overflowDoc = await agentCheckpointChannelValuesCollection(
        userId,
        threadId,
      )
        .doc(parsedRecord.data.overflowRef)
        .get();
      const parsedOverflow = overflowRecordSchema.safeParse(overflowDoc.data());
      if (!parsedOverflow.success) {
        throw new CheckpointOverflowUnavailableError();
      }
      const overflowBytes = toSerdeBytes(parsedOverflow.data.channelValues);
      if (!overflowBytes) {
        throw new CheckpointOverflowUnavailableError();
      }
      const overflowValues: unknown = await this.serde.loadsTyped(
        'json',
        overflowBytes,
      );
      applyOverflowChannelValues(loadedCheckpoint, overflowValues);
    }

    const loadedMetadata: unknown = await this.serde.loadsTyped(
      'json',
      metadataBytes,
    );
    if (!isCheckpointMetadata(loadedMetadata)) {
      throw new Error('Workspace agent checkpoint metadata is invalid');
    }

    const writesSnapshot = await collection
      .doc(checkpointId)
      .collection('writes')
      .get();
    const pendingWrites = await Promise.all(
      writesSnapshot.docs.map(async (writeDoc) => {
        const parsedWrite = pendingWriteRecordSchema.safeParse(writeDoc.data());
        if (!parsedWrite.success) {
          throw new Error('Workspace agent checkpoint write record is invalid');
        }
        const writeBytes = toSerdeBytes(parsedWrite.data.value);
        if (!writeBytes) {
          throw new Error('Workspace agent checkpoint write record is invalid');
        }
        const parsed = parseWritesDocId(writeDoc.id);
        const value: unknown = await this.serde.loadsTyped('json', writeBytes);
        return [parsed.taskId, parsedWrite.data.channel, value] as [
          string,
          string,
          unknown,
        ];
      }),
    );

    const tuple: CheckpointTuple = {
      config: {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNamespace,
          checkpoint_id: checkpointId,
          userId,
        },
      },
      checkpoint: loadedCheckpoint,
      metadata: loadedMetadata,
      pendingWrites,
    };

    const parentCheckpointId = parsedRecord.data.parentCheckpointId ?? undefined;
    if (parentCheckpointId) {
      tuple.parentConfig = {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNamespace,
          checkpoint_id: parentCheckpointId,
          userId,
        },
      };
    }

    return tuple;
  }

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions,
  ): AsyncGenerator<CheckpointTuple> {
    const userId = this.resolveUserId(config);
    const threadId = this.resolveThreadId(config);
    const checkpointNamespace = this.checkpointNamespace(config);
    const collection = agentCheckpointCollection(userId, threadId);
    let query = collection
      .where('checkpointNamespace', '==', checkpointNamespace)
      .orderBy('checkpointId', 'desc');

    if (options?.before?.configurable?.checkpoint_id) {
      query = query.where(
        'checkpointId',
        '<',
        options.before.configurable.checkpoint_id,
      );
    }

    const limit = options?.limit ?? 10;
    const snapshot = await query.limit(limit).get();

    for (const doc of snapshot.docs) {
      const tuple = await this.getTuple({
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNamespace,
          checkpoint_id: doc.id,
          userId,
        },
      });
      if (tuple) {
        yield tuple;
      }
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: ChannelVersions,
  ): Promise<RunnableConfig> {
    const userId = this.resolveUserId(config);
    const threadId = this.resolveThreadId(config);
    const checkpointNamespace = this.checkpointNamespace(config);
    const preparedCheckpoint = copyCheckpoint(checkpoint);
    const [, serializedCheckpoint] = await this.serde.dumpsTyped(
      preparedCheckpoint,
    );
    const [, serializedMetadata] = await this.serde.dumpsTyped(metadata);

    const now = new Date();
    const expiresAt = computeExpiresAt(now, 'agentCheckpoint');
    const parentCheckpointId = config.configurable?.checkpoint_id;

    const turnRef = agentCheckpointTurnRef(userId, threadId);
    const checkpointRef = agentCheckpointCollection(userId, threadId).doc(
      checkpoint.id,
    );

    await turnRef.set(
      {
        turnKey: threadId,
        updatedAt: Timestamp.fromDate(now),
        expiresAt,
      },
      { merge: true },
    );

    let overflowRef: string | undefined;
    let inlineCheckpointBytes = serializedCheckpoint;

    if (serializedCheckpoint.byteLength > MAX_INLINE_BYTES) {
      const channelValues = preparedCheckpoint.channel_values;
      preparedCheckpoint.channel_values = {};
      const [, channelValuesBytes] = await this.serde.dumpsTyped(channelValues);
      if (channelValuesBytes.byteLength > MAX_INLINE_BYTES) {
        throw new CheckpointSerializationTooLargeError(
          channelValuesBytes.byteLength,
        );
      }
      overflowRef = checkpoint.id;
      inlineCheckpointBytes = (
        await this.serde.dumpsTyped(preparedCheckpoint)
      )[1];

      await agentCheckpointChannelValuesCollection(userId, threadId)
        .doc(overflowRef)
        .set({
          channelValues: channelValuesBytes,
          expiresAt,
          updatedAt: Timestamp.fromDate(now),
        });
    }

    await checkpointRef.set({
      checkpointId: checkpoint.id,
      checkpointNamespace,
      checkpoint: inlineCheckpointBytes,
      metadata: serializedMetadata,
      parentCheckpointId: parentCheckpointId ?? null,
      overflowRef: overflowRef ?? null,
      expiresAt,
      updatedAt: Timestamp.fromDate(now),
    });

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNamespace,
        checkpoint_id: checkpoint.id,
        userId,
      },
    };
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
  ): Promise<void> {
    const userId = this.resolveUserId(config);
    const threadId = this.resolveThreadId(config);
    const checkpointId = config.configurable?.checkpoint_id;
    if (typeof checkpointId !== 'string' || checkpointId.length === 0) {
      throw new Error(
        'FirestoreCheckpointSaver putWrites requires configurable.checkpoint_id',
      );
    }

    const writesCollection = agentCheckpointCollection(userId, threadId)
      .doc(checkpointId)
      .collection('writes');
    const expiresAt = computeExpiresAt(new Date(), 'agentCheckpoint');

    await Promise.all(
      writes.map(async ([channel, value], idx) => {
        const [, serializedValue] = await this.serde.dumpsTyped(value);
        const writeIdx = WRITES_IDX_MAP[channel] ?? idx;
        await writesCollection.doc(writesDocId(taskId, writeIdx)).set({
          channel,
          value: serializedValue,
          taskId,
          expiresAt,
        });
      }),
    );
  }

  async deleteThread(threadId: string): Promise<void> {
    throw new Error(
      `deleteThread requires userId context; call deleteAgentTurnCheckpoints(userId, turnKey) instead for ${threadId}`,
    );
  }
}

async function commitDeletes(
  firestore: Firestore,
  refs: DocumentReference[],
): Promise<void> {
  for (let index = 0; index < refs.length; index += FIRESTORE_BATCH_LIMIT) {
    const batch = firestore.batch();
    for (const ref of refs.slice(index, index + FIRESTORE_BATCH_LIMIT)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

export async function deleteAgentTurnCheckpoints(
  userId: string,
  turnKey: string,
): Promise<void> {
  const turnRef = agentCheckpointTurnRef(userId, turnKey);
  const checkpoints = await agentCheckpointCollection(userId, turnKey).get();
  const channelValues = await agentCheckpointChannelValuesCollection(
    userId,
    turnKey,
  ).get();
  const refs: DocumentReference[] = [];

  for (const checkpointDoc of checkpoints.docs) {
    const writes = await checkpointDoc.ref.collection('writes').get();
    for (const writeDoc of writes.docs) {
      refs.push(writeDoc.ref);
    }
    refs.push(checkpointDoc.ref);
  }

  for (const overflowDoc of channelValues.docs) {
    refs.push(overflowDoc.ref);
  }
  refs.push(turnRef);

  await commitDeletes(turnRef.firestore, refs);
}

export interface IAgentTurnCompletion {
  reply: string;
  executedActions: AgentActionResult[];
  proposedDeletes: AgentProposedDelete[];
}

export async function claimAgentTurnCompletion(
  userId: string,
  turnKey: string,
  completion: IAgentTurnCompletion,
): Promise<{ alreadyCompleted: boolean; completion: IAgentTurnCompletion }> {
  const turnRef = agentCheckpointTurnRef(userId, turnKey);
  return turnRef.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(turnRef);
    const data = snapshot.data();
    if (typeof data?.completedReply === 'string' && data.completedReply.length > 0) {
      return {
        alreadyCompleted: true,
        completion: {
          reply: data.completedReply,
          executedActions: parseCompletedActions(data.completedExecutedActions),
          proposedDeletes: parseCompletedDeletes(data.completedProposedDeletes),
        },
      };
    }

    transaction.set(
      turnRef,
      {
        completedReply: completion.reply,
        completedExecutedActions: completion.executedActions,
        completedProposedDeletes: completion.proposedDeletes,
        completedAt: Timestamp.now(),
      },
      { merge: true },
    );

    return { alreadyCompleted: false, completion };
  });
}
