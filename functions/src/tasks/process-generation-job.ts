import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { ArtifactAgentPipelineFailedError } from '../services/artifact-agent/artifact-agent-errors';
import { failVisibleGenerationRecord } from '../services/generation-job-failures';
import {
  formatGenerationError,
  MAX_GENERATION_JOB_ATTEMPTS,
  shouldRetryGenerationJob,
} from '../services/generation-job-retry';
import { STALE_PENDING_SWEEP_MESSAGE } from '../services/generation-stale';
import { GenerationJob, GenerationJobsService } from '../services/generation-jobs';
import { ArtifactAgentGenerationProcessor } from '../services/generation-processors/artifact-agent';
import { DocumentFromPromptGenerationProcessor } from '../services/generation-processors/document-from-prompt';
import { DocumentFromScreenshotGenerationProcessor } from '../services/generation-processors/document-from-screenshot';
import { FlashcardsGenerationProcessor } from '../services/generation-processors/flashcards';
import { QuizGenerationProcessor } from '../services/generation-processors/quiz';
import { SequenceQuizGenerationProcessor } from '../services/generation-processors/sequence-quiz';
import { SlideDeckGenerationProcessor } from '../services/generation-processors/slide-deck';
import { SubjectWorldGenerationProcessor } from '../services/generation-processors/subject-world';
import { ProcessGenerationJobTaskPayload } from '../services/generation-task-queue';

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const llmSettingsEncryptionKey = defineSecret('LLM_SETTINGS_ENCRYPTION_KEY');

async function processJob(job: GenerationJob): Promise<void> {
  switch (job.kind) {
    case 'documentFromPrompt':
      await DocumentFromPromptGenerationProcessor.process(job);
      return;
    case 'documentFromScreenshot':
      await DocumentFromScreenshotGenerationProcessor.process(job);
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
    case 'subjectWorld':
      await SubjectWorldGenerationProcessor.process(job);
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
      await GenerationJobsService.markFailed(userId, jobId, STALE_PENDING_SWEEP_MESSAGE).catch((failError) => {
        logger.error('Failed to mark stale generation job as failed', {
          userId,
          jobId,
          recordId: staleJob.recordId,
          error: failError instanceof Error ? failError.message : String(failError),
        });
      });
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
      await processJob(job);
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

      if (error instanceof ArtifactAgentPipelineFailedError) {
        await GenerationJobsService.markFailed(userId, jobId, message).catch((failError) => {
          logger.error('Failed to mark generation job as failed', {
            userId,
            jobId,
            recordId: job.recordId,
            error: failError instanceof Error ? failError.message : String(failError),
          });
        });
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
          await GenerationJobsService.markFailed(userId, jobId, message).catch((failError) => {
            logger.error('Failed to mark generation job as failed', {
              userId,
              jobId,
              recordId: job.recordId,
              error: failError instanceof Error ? failError.message : String(failError),
            });
          });
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
      await GenerationJobsService.markFailed(userId, jobId, message).catch((failError) => {
        logger.error('Failed to mark generation job as failed', {
          userId,
          jobId,
          recordId: job.recordId,
          error: failError instanceof Error ? failError.message : String(failError),
        });
      });
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
