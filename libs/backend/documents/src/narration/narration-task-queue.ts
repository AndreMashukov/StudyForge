import { getFunctions } from 'firebase-admin/functions';
import { logger } from 'firebase-functions/v2';

/** The run's reservations live on `narrationRuns/{runId}`, not in the task. */
export interface INarrationRunTaskPayload {
  userId: string;
  documentId: string;
  runId: string;
}

const NARRATION_RUN_QUEUE =
  'locations/asia-east1/functions/generateDocumentNarrationTask';

function isTaskAlreadyExistsError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return 'code' in error && error.code === 'functions/task-already-exists';
}

export async function enqueueNarrationRunTask(
  payload: INarrationRunTaskPayload,
): Promise<void> {
  const queue =
    getFunctions().taskQueue<INarrationRunTaskPayload>(NARRATION_RUN_QUEUE);
  try {
    // The run id is unique per start, so it deduplicates a repeated enqueue.
    await queue.enqueue(payload, {
      id: `narration-${payload.runId}`,
      dispatchDeadlineSeconds: 600,
    });
  } catch (error) {
    if (isTaskAlreadyExistsError(error)) return;
    throw error;
  }
  logger.info('Narration run task enqueued', {
    userId: payload.userId,
    documentId: payload.documentId,
    runId: payload.runId,
  });
}

export function isNarrationRunTaskPayload(
  value: unknown,
): value is INarrationRunTaskPayload {
  if (typeof value !== 'object' || value === null) return false;
  const read = (key: string) =>
    key in value ? Reflect.get(value, key) : undefined;
  return (
    typeof read('userId') === 'string' &&
    typeof read('documentId') === 'string' &&
    typeof read('runId') === 'string'
  );
}
