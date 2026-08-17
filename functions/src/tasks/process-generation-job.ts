import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { ArtifactAgentPipelineFailedError } from '@study-forge/backend-artifacts/artifact-agent/artifact-agent-errors';
import { DocumentAgentPipelineFailedError } from '@study-forge/backend-documents/document-agent/document-agent-errors';
import { DocumentAgentGenerationProcessor } from '@study-forge/backend-generation/generation-processors/document-agent';
import { failVisibleGenerationRecord } from '@study-forge/backend-generation/generation-job-failures';
import {
  formatGenerationError,
  MAX_GENERATION_JOB_ATTEMPTS,
  shouldRetryGenerationJob,
} from '@study-forge/backend-generation/generation-job-retry';
import { STALE_PENDING_SWEEP_MESSAGE } from '@study-forge/backend-generation/generation-stale';
import { GenerationJob, GenerationJobsService } from '@study-forge/backend-generation/generation-jobs';
import { ArtifactAgentGenerationProcessor } from '@study-forge/backend-generation/generation-processors/artifact-agent';
import { DocumentFromPromptGenerationProcessor } from '@study-forge/backend-generation/generation-processors/document-from-prompt';
import { DocumentFromScreenshotGenerationProcessor } from '@study-forge/backend-generation/generation-processors/document-from-screenshot';
import { FlashcardsGenerationProcessor } from '@study-forge/backend-generation/generation-processors/flashcards';
import { QuizGenerationProcessor } from '@study-forge/backend-generation/generation-processors/quiz';
import { SequenceQuizGenerationProcessor } from '@study-forge/backend-generation/generation-processors/sequence-quiz';
import { SlideDeckGenerationProcessor } from '@study-forge/backend-generation/generation-processors/slide-deck';
import { ProcessGenerationJobTaskPayload } from '@study-forge/backend-generation/generation-task-queue';
import {
  buildProviderCostContext,
  runWithProviderCostContext,
} from '@study-forge/backend-core/services/provider-cost';
import {
  mapJobKindToUsageGenerationKind,
  settleJobUsageReservation,
} from '@study-forge/backend-core/services/usage-limits-service';

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const llmSettingsEncryptionKey = defineSecret('LLM_SETTINGS_ENCRYPTION_KEY');

async function settleGenerationJobReservations(
  job: GenerationJob,
  succeeded: boolean,
): Promise<void> {
  await settleJobUsageReservation({
    userId: job.userId,
    reservationId: job.usageReservationId,
    dailySlideDeckReservationId: job.dailySlideDeckReservationId,
    succeeded,
  });
}

async function markFailedThenSettle(
  job: GenerationJob,
  message: string,
  logContext: string,
): Promise<void> {
  try {
    await GenerationJobsService.markFailed(job.userId, job.id, message);
  } catch (failError) {
    logger.error(`Failed to mark ${logContext} generation job as failed`, {
      userId: job.userId,
      jobId: job.id,
      recordId: job.recordId,
      error: failError instanceof Error ? failError.message : String(failError),
    });
    return;
  }

  await settleGenerationJobReservations(job, false).catch((settleError) => {
    logger.error(`Failed to refund usage reservation for ${logContext} generation job`, {
      userId: job.userId,
      jobId: job.id,
      reservationId: job.usageReservationId,
      dailySlideDeckReservationId: job.dailySlideDeckReservationId,
      error: settleError instanceof Error ? settleError.message : String(settleError),
    });
  });
}

async function markCompletedThenSettle(job: GenerationJob): Promise<void> {
  try {
    await GenerationJobsService.markCompleted(job.userId, job.id);
  } catch (error) {
    logger.error('Failed to mark generation job as completed', {
      userId: job.userId,
      jobId: job.id,
      kind: job.kind,
      recordId: job.recordId,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  await settleGenerationJobReservations(job, true).catch((settleError) => {
    logger.error('Failed to commit usage reservation for completed generation job', {
      userId: job.userId,
      jobId: job.id,
      reservationId: job.usageReservationId,
      dailySlideDeckReservationId: job.dailySlideDeckReservationId,
      error: settleError instanceof Error ? settleError.message : String(settleError),
    });
  });
}

async function processJobWithProviderCostContext(job: GenerationJob): Promise<void> {
  const context = buildProviderCostContext({
    userId: job.userId,
    generationKind: mapJobKindToUsageGenerationKind(job.kind),
    reservationId: job.usageReservationId,
    jobId: job.id,
    recordId: job.recordId,
    callRole: 'generation',
  });

  await runWithProviderCostContext(context, () => processJob(job));
}

async function processJob(job: GenerationJob): Promise<void> {
  switch (job.kind) {
    case 'documentFromPrompt':
      await DocumentFromPromptGenerationProcessor.process(job);
      return;
    case 'documentFromScreenshot':
      await DocumentFromScreenshotGenerationProcessor.process(job);
      return;
    case 'documentFromUpload':
    case 'documentFromUrl':
    case 'documentFromContent':
      await DocumentAgentGenerationProcessor.process(job);
      return;
    case 'artifactAgent':
      await ArtifactAgentGenerationProcessor.process(job);
      return;
    case 'quiz':
      await QuizGenerationProcessor.process(job);
      return;
    case 'flashcards':
      await FlashcardsGenerationProcessor.process(job);
      return;
    case 'sequenceQuiz':
      await SequenceQuizGenerationProcessor.process(job);
      return;
    case 'slideDeck':
      await SlideDeckGenerationProcessor.process(job);
      return;
    default:
      throw new Error(`Unsupported generation job kind: ${job.kind}`);
  }
}

export const processGenerationJob = onTaskDispatched<ProcessGenerationJobTaskPayload>(
  {
    region: 'asia-east1',
    retryConfig: {
      maxAttempts: MAX_GENERATION_JOB_ATTEMPTS,
      minBackoffSeconds: 30,
      maxBackoffSeconds: 300,
      maxDoublings: 2,
    },
    rateLimits: {
      maxConcurrentDispatches: 3,
    },
    secrets: [geminiApiKey, llmSettingsEncryptionKey],
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (request) => {
    const { userId, jobId } = request.data;

    if (!userId || !jobId) {
      logger.error('Generation task missing required payload fields', { userId, jobId });
      return;
    }

    const claimResult = await GenerationJobsService.claimJobForProcessing(userId, jobId);
    if (claimResult.type === 'missing') {
      logger.error('Generation job not found for task', { userId, jobId });
      return;
    }

    if (claimResult.type === 'failed_stale') {
      const staleJob = claimResult.job;
      logger.warn('Failing stale processing generation job', {
        userId,
        jobId,
        kind: staleJob.kind,
        recordId: staleJob.recordId,
        attempts: staleJob.attempts,
      });
      await failVisibleGenerationRecord(staleJob, STALE_PENDING_SWEEP_MESSAGE).catch((failError) => {
        logger.error('Failed to mark visible generation record as failed for stale job', {
          userId,
          jobId,
          recordId: staleJob.recordId,
          error: failError instanceof Error ? failError.message : String(failError),
        });
      });
      await markFailedThenSettle(staleJob, STALE_PENDING_SWEEP_MESSAGE, 'stale');
      return;
    }

    if (claimResult.type === 'skip') {
      logger.info('Skipping non-queued generation job', {
        userId,
        jobId,
        status: claimResult.job.status,
      });
      return;
    }

    const job = claimResult.job;

    try {
      await processJobWithProviderCostContext(job);
    } catch (error) {
      const message = formatGenerationError(error);
      const retryCount = request.retryCount ?? 0;
      const executionCount = request.executionCount ?? retryCount + 1;

      logger.error('Generation job failed', {
        userId,
        jobId,
        kind: job.kind,
        recordId: job.recordId,
        retryCount,
        executionCount,
        attempts: job.attempts,
        error: message,
      });

      if (error instanceof ArtifactAgentPipelineFailedError || error instanceof DocumentAgentPipelineFailedError) {
        await failVisibleGenerationRecord(job, message).catch((failError) => {
          logger.error('Failed to mark visible generation record as failed', {
            userId,
            jobId,
            recordId: job.recordId,
            error: failError instanceof Error ? failError.message : String(failError),
          });
        });
        await markFailedThenSettle(job, message, 'failed');
        return;
      }

      if (shouldRetryGenerationJob(error, retryCount)) {
        try {
          await GenerationJobsService.markRetryableFailure(userId, jobId, message);
        } catch (retryError) {
          logger.error('Failed to mark generation job for retry', {
            userId,
            jobId,
            recordId: job.recordId,
            error: retryError instanceof Error ? retryError.message : String(retryError),
          });
          await failVisibleGenerationRecord(job, message).catch((failError) => {
            logger.error('Failed to mark visible generation record as failed', {
              userId,
              jobId,
              recordId: job.recordId,
              error: failError instanceof Error ? failError.message : String(failError),
            });
          });
          await markFailedThenSettle(job, message, 'failed');
          throw error instanceof Error ? error : new Error(message);
        }
        throw error instanceof Error ? error : new Error(message);
      }

      await failVisibleGenerationRecord(job, message).catch((failError) => {
        logger.error('Failed to mark visible generation record as failed', {
          userId,
          jobId,
          recordId: job.recordId,
          error: failError instanceof Error ? failError.message : String(failError),
        });
      });
      await markFailedThenSettle(job, message, 'failed');
      return;
    }

    await markCompletedThenSettle(job);
    logger.info('Generation job completed', { userId, jobId, kind: job.kind, recordId: job.recordId });
  }
);
