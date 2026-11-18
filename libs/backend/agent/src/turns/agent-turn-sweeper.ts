import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import {
  AGENT_TURN_SWEEP_STALE_THRESHOLDS,
  isAgentTurnStale,
} from './agent-turn-decisions';
import { finalizeAgentTurn } from './agent-turn-finalize';
import { parseAgentTurnRecord } from './agent-turn-record';
import { buildStaleTurnState } from './agent-turn-service';

const SWEEP_PAGE_SIZE = 100;

export interface IStaleAgentTurnSweepStats {
  scanned: number;
  failed: number;
}

/**
 * Fails turns whose worker died without finalizing (instance lost, timeout,
 * enqueue that never dispatched). Keeps partial reply and actions, writes the
 * assistant message, clears the thread's active turn and settles credits.
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
  const snapshot = await getFirestore()
    .collectionGroup('turns')
    .where('status', 'in', ['queued', 'running'])
    .where('updatedAt', '<', cutoff)
    .orderBy('updatedAt', 'asc')
    .limit(SWEEP_PAGE_SIZE)
    .get();

  const stats: IStaleAgentTurnSweepStats = { scanned: snapshot.size, failed: 0 };

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
        state: buildStaleTurnState(turn, 'failed'),
        // Re-check inside the transaction: a late heartbeat means it is alive.
        guard: (current) =>
          isAgentTurnStale(current, Date.now(), AGENT_TURN_SWEEP_STALE_THRESHOLDS),
        settlement: turn.status === 'queued' ? 'refund' : 'settle',
      });
      if (result.didTransition) {
        stats.failed += 1;
      }
    } catch (error) {
      logger.error('Failed to finalize stale agent turn', {
        userId: turn.userId,
        threadId: turn.threadId,
        turnId: turn.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (stats.failed > 0) {
    logger.warn('Stale agent turns failed', stats);
  }
  return stats;
}
