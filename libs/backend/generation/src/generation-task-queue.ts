import { getFunctions } from 'firebase-admin/functions';
import { logger } from 'firebase-functions/v2';

export interface ProcessGenerationJobTaskPayload {
  userId: string;
  jobId: string;
}

const PROCESS_GENERATION_JOB_QUEUE = 'locations/asia-east1/functions/processGenerationJob';

export async function enqueueGenerationJobTask(payload: ProcessGenerationJobTaskPayload): Promise<void> {
  const queue = getFunctions().taskQueue<ProcessGenerationJobTaskPayload>(PROCESS_GENERATION_JOB_QUEUE);
  await queue.enqueue(payload, {
    id: payload.jobId,
    dispatchDeadlineSeconds: 1800,
  });
  logger.info('Generation job task enqueued', payload);
}