import { getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import type { AgentTurn, IAgentThread } from '@shared-types';
import {
  agentActionResultSchema,
  agentProposedDeleteSchema,
  agentReferencedItemSchema,
  agentTurnSchema,
} from '@shared-types';
import {
  optionalTimestampToIso,
  parseList,
  timestampToIso,
} from './agentFirestoreValues';
import { mapAgentThread } from './agentThreadFirestore';
import { agentThreadRef, agentThreadTurnRef } from './firestorePaths';

/**
 * Durable agent turns (ADR 010). A turn runs in a server worker and survives
 * the app closing; clients follow it through its turn doc and the thread doc.
 */

export interface IAgentSnapshotMeta {
  /** Served from the local cache; never make terminal decisions from it. */
  fromCache: boolean;
}

export function mapAgentTurn(
  id: string,
  threadId: string,
  data: Record<string, unknown> | undefined,
): AgentTurn | null {
  if (!data) {
    return null;
  }
  const fallbackIso = new Date().toISOString();
  const parsed = agentTurnSchema.safeParse({
    ...data,
    id,
    threadId,
    executedActions: parseList(data.executedActions, agentActionResultSchema),
    proposedDeletes: parseList(data.proposedDeletes, agentProposedDeleteSchema),
    referencedItems: parseList(data.referencedItems, agentReferencedItemSchema),
    createdAt: timestampToIso(data.createdAt, fallbackIso),
    updatedAt: timestampToIso(data.updatedAt, fallbackIso),
    startedAt: optionalTimestampToIso(data.startedAt),
    heartbeatAt: optionalTimestampToIso(data.heartbeatAt),
    completedAt: optionalTimestampToIso(data.completedAt),
  });
  return parsed.success ? parsed.data : null;
}

export async function getAgentTurnFromFirestore(
  userId: string,
  threadId: string,
  turnId: string,
): Promise<AgentTurn | null> {
  const snapshot = await getDoc(agentThreadTurnRef(userId, threadId, turnId));
  return snapshot.exists()
    ? mapAgentTurn(snapshot.id, threadId, snapshot.data())
    : null;
}

export function subscribeAgentTurn(
  userId: string,
  threadId: string,
  turnId: string,
  handlers: {
    onTurn: (turn: AgentTurn | null, meta: IAgentSnapshotMeta) => void;
    onError?: (error: Error) => void;
  },
): Unsubscribe {
  return onSnapshot(
    agentThreadTurnRef(userId, threadId, turnId),
    { includeMetadataChanges: true },
    (snapshot) => {
      handlers.onTurn(
        snapshot.exists()
          ? mapAgentTurn(snapshot.id, threadId, snapshot.data())
          : null,
        { fromCache: snapshot.metadata.fromCache },
      );
    },
    (error) => handlers.onError?.(error),
  );
}

/** Thread doc only (title, preview, activeTurnId); messages are refetched on change. */
export function subscribeAgentThread(
  userId: string,
  threadId: string,
  handlers: {
    onThread: (thread: IAgentThread | null, meta: IAgentSnapshotMeta) => void;
    onError?: (error: Error) => void;
  },
): Unsubscribe {
  return onSnapshot(
    agentThreadRef(userId, threadId),
    { includeMetadataChanges: true },
    (snapshot) => {
      handlers.onThread(
        snapshot.exists()
          ? mapAgentThread(
              snapshot.id,
              snapshot.data(),
              userId,
              new Date().toISOString(),
            )
          : null,
        { fromCache: snapshot.metadata.fromCache },
      );
    },
    (error) => handlers.onError?.(error),
  );
}
