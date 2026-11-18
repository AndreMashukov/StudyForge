import { createHash } from 'node:crypto';
import { getFunctions } from 'firebase-admin/functions';
import { logger } from 'firebase-functions/v2';

export interface IRunAgentTurnTaskPayload {
  userId: string;
  threadId: string;
  turnId: string;
}

const RUN_AGENT_TURN_QUEUE = 'locations/asia-east1/functions/runAgentTurnTask';

/** Deterministic task id, so enqueueing the same turn twice is deduplicated. */
export function buildAgentTurnTaskId(payload: IRunAgentTurnTaskPayload): string {
  return createHash('sha256')
    .update(`${payload.userId}:${payload.threadId}:${payload.turnId}`)
    .digest('hex')
    .slice(0, 40);
}

function isTaskAlreadyExistsError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const code = 'code' in error ? error.code : undefined;
  return code === 'functions/task-already-exists';
}

export async function enqueueAgentTurnTask(
  payload: IRunAgentTurnTaskPayload,
): Promise<void> {
  const queue =
    getFunctions().taskQueue<IRunAgentTurnTaskPayload>(RUN_AGENT_TURN_QUEUE);
  try {
    await queue.enqueue(payload, {
      id: buildAgentTurnTaskId(payload),
      dispatchDeadlineSeconds: 600,
    });
  } catch (error) {
    if (isTaskAlreadyExistsError(error)) {
      return;
    }
    throw error;
  }
  logger.info('Agent turn task enqueued', payload);
}
