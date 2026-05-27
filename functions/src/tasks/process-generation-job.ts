import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { DocumentCrudService } from '../services/document-crud';
import { DocumentFromPromptGenerationProcessor } from '../services/generation-processors/document-from-prompt';
import { GenerationJob, GenerationJobsService } from '../services/generation-jobs';
import { ProcessGenerationJobTaskPayload } from '../services/generation-task-queue';

const geminiApiKey = defineSecret('GEMINI_API_KEY');

async function failVisibleRecord(job: GenerationJob, message: string): Promise<void> {
  switch (job.kind) {
    case 'documentFromPrompt':
      await DocumentCrudService.failPendingDocument(job.userId, job.recordId, message);
      return;
    default:
      throw new Error(`Unsupported generation job kind: ${job.kind}`);
  }
}

async function processJob(job: GenerationJob): Promise<void> {
  switch (job.kind) {
    case 'documentFromPrompt':
      await DocumentFromPromptGenerationProcessor.process(job);
      return;
    default:
      throw new Error(`Unsupported generation job kind: ${job.kind}`);
  }
}

export const processGenerationJob = onTaskDispatched<ProcessGenerationJobTaskPayload>(
  {
    region: 'asia-east1',
    retryConfig: {
      maxAttempts: 1,
    },
    rateLimits: {
      maxConcurrentDispatches: 3,
    },
    secrets: [geminiApiKey],
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (request) => {
    const { userId, jobId } = request.data;

    if (!userId || !jobId) {
      logger.error('Generation task missing required payload fields', { userId, jobId });
      return;
    }

    const job = await GenerationJobsService.claimQueuedJob(userId, jobId);
    if (!job) {
      const existingJob = await GenerationJobsService.getJob(userId, jobId);
      if (!existingJob) {
        logger.error('Generation job not found for task', { userId, jobId });
        return;
      }
      logger.info('Skipping non-queued generation job', { userId, jobId, status: existingJob.status });
      return;
    }

    try {
      await processJob(job);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Generation job failed', { userId, jobId, kind: job.kind, recordId: job.recordId, error: message });
      await failVisibleRecord(job, message).catch((failError) => {
        logger.error('Failed to mark visible generation record as failed', {
          userId,
          jobId,
          recordId: job.recordId,
          error: failError instanceof Error ? failError.message : String(failError),
        });
      });
      await GenerationJobsService.markFailed(userId, jobId, message);
      return;
    }

    await GenerationJobsService.markCompleted(userId, jobId).catch((error) => {
      logger.error('Failed to mark generation job as completed', {
        userId,
        jobId,
        kind: job.kind,
        recordId: job.recordId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    logger.info('Generation job completed', { userId, jobId, kind: job.kind, recordId: job.recordId });
  }
);