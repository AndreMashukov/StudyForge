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
import { computeExpiresAt } from '@study-forge/backend-core/lib/firestore-ttl';
import {
  agentCheckpointCollection,
  agentCheckpointChannelValuesCollection,
  agentCheckpointTurnRef,
} from './firestore-checkpoint-paths';

const MAX_INLINE_BYTES = 800_000;

function writesDocId(taskId: string, idx: number): string {
  return `${taskId}__${idx}`;
}

function parseWritesDocId(docId: string): { taskId: string; idx: number } {
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

    const data = doc.data();
    if (!data) {
      return undefined;
    }

    const checkpoint = await this.serde.loadsTyped(
      'json',
      data.checkpoint as Uint8Array,
    );

    if (typeof data.overflowRef === 'string' && data.overflowRef.length > 0) {
      const overflowDoc = await agentCheckpointChannelValuesCollection(
        userId,
        threadId,
      )
        .doc(data.overflowRef)
        .get();
      const overflowData = overflowDoc.data();
      if (overflowData?.channelValues) {
        checkpoint.channel_values = await this.serde.loadsTyped(
          'json',
          overflowData.channelValues as Uint8Array,
        );
      }
    }

    const metadata = await this.serde.loadsTyped(
      'json',
      data.metadata as Uint8Array,
    );

    const writesSnapshot = await collection
      .doc(checkpointId)
      .collection('writes')
      .get();
    const pendingWrites = await Promise.all(
      writesSnapshot.docs.map(async (writeDoc) => {
        const writeData = writeDoc.data();
        const parsed = parseWritesDocId(writeDoc.id);
        return [
          parsed.taskId,
          writeData.channel as string,
          await this.serde.loadsTyped('json', writeData.value as Uint8Array),
        ] as [string, string, unknown];
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
      checkpoint,
      metadata,
      pendingWrites,
    };

    const parentCheckpointId =
      typeof data.parentCheckpointId === 'string'
        ? data.parentCheckpointId
        : undefined;
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

    await Promise.all(
      writes.map(async ([channel, value], idx) => {
        const [, serializedValue] = await this.serde.dumpsTyped(value);
        const writeIdx = WRITES_IDX_MAP[channel] ?? idx;
        await writesCollection.doc(writesDocId(taskId, writeIdx)).set({
          channel,
          value: serializedValue,
          taskId,
        });
      }),
    );
  }

  async deleteThread(threadId: string): Promise<void> {
    throw new Error(
      `deleteThread requires userId context; call deleteAgentTurn(userId, turnKey) instead for ${threadId}`,
    );
  }
}

export async function deleteAgentTurnCheckpoints(
  userId: string,
  turnKey: string,
): Promise<void> {
  const turnRef = agentCheckpointTurnRef(userId, turnKey);
  const checkpoints = await agentCheckpointCollection(userId, turnKey).get();
  const batch = turnRef.firestore.batch();
  for (const doc of checkpoints.docs) {
    batch.delete(doc.ref);
  }
  batch.delete(turnRef);
  await batch.commit();
}
