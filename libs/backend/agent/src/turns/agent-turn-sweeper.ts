import {
  FieldPath,
  Timestamp,
  getFirestore,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import {
  AGENT_TURN_SWEEP_STALE_THRESHOLDS,
  isAgentTurnStale,
} from './agent-turn-decisions';
import { finalizeAgentTurn } from './agent-turn-finalize';
import { parseAgentTurnRecord } from './agent-turn-record';
import { buildStaleTurnState } from './agent-turn-service';

const SWEEP_PAGE_SIZE = 100;
/** Bounds one run; turns left over are picked up by the next run. */
const SWEEP_MAX_PAGES = 5;

export interface IStaleAgentTurnSweepStats {
  scanned: number;
  failed: number;
  /** Stale turns whose finalize threw; the next run retries them. */
  errors: number;
}

/**
 * Fails turns whose worker died without finalizing (instance lost, timeout,
 * enqueue that never dispatched). Keeps partial reply and actions, writes the
 * assistant message, clears the thread's active turn and settles credits.
 * Pages through candidates in a stable order, so turns it skips (still live,
 * or a finalize that failed) never hide later stale ones.
 */
export async function sweepStaleAgentTurns(
  now: Date = new Date(),
): Promise<IStaleAgentTurnSweepStats> {
  const nowMs = now.getTime();
  const cutoff = Timestamp.fromMillis(
    nowMs -
      Math.min(
        AGENT_TURN_SWEEP_STALE_THRESHOLDS.queuedMs,
        AGENT_TURN_SWEEP_STALE_THRESHOLDS.runningMs,
      ),
  );
  const baseQuery = getFirestore()
    .collectionGroup('turns')
    .where('status', 'in', ['queued', 'running'])
    .where('updatedAt', '<', cutoff)
    .orderBy('updatedAt', 'asc')
    .orderBy(FieldPath.documentId(), 'asc')
    .limit(SWEEP_PAGE_SIZE);

  const stats: IStaleAgentTurnSweepStats = { scanned: 0, failed: 0, errors: 0 };
  let cursor: QueryDocumentSnapshot | undefined;

  for (let page = 0; page < SWEEP_MAX_PAGES; page += 1) {
    const snapshot = await (cursor ? baseQuery.startAfter(cursor) : baseQuery).get();
    stats.scanned += snapshot.size;

    for (const doc of snapshot.docs) {
      const turn = parseAgentTurnRecord(doc.data());
      if (!turn || !isAgentTurnStale(turn, nowMs, AGENT_TURN_SWEEP_STALE_THRESHOLDS)) {
        continue;
      }
      try {
        const result = await finalizeAgentTurn({
          userId: turn.userId,
          threadId: turn.threadId,
          turnId: turn.id,
          // Re-check inside the transaction: a late heartbeat means it is alive.
          guard: (current) =>
            isAgentTurnStale(current, Date.now(), AGENT_TURN_SWEEP_STALE_THRESHOLDS),
          state: (current) => buildStaleTurnState(current, 'failed'),
          settlement: (current) =>
            current.status === 'queued' ? 'refund' : 'settle',
        });
        if (result.didTransition) {
          stats.failed += 1;
        }
      } catch (error) {
        stats.errors += 1;
        logger.error('Failed to finalize stale agent turn', {
          userId: turn.userId,
          threadId: turn.threadId,
          turnId: turn.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (snapshot.size < SWEEP_PAGE_SIZE) {
      break;
    }
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }

  if (stats.failed > 0 || stats.errors > 0) {
    logger.warn('Stale agent turns failed', stats);
  }
  return stats;
}
