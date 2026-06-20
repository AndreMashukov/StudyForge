import { logger } from 'firebase-functions/v2';
import { FirestorePaths } from '../../lib/firestore-paths';
import { GenerationJob } from '../generation-jobs';
import { GenerationJobPayloadStorage } from '../generation-job-payload-storage';
import {
  ArtifactAgentJobInput,
  ArtifactAgentJobPayload,
  runArtifactAgentPipeline,
} from '../artifact-agent';

export class ArtifactAgentGenerationProcessor {
  static async process(job: GenerationJob): Promise<void> {
    const recordSnap = await FirestorePaths.diagramQuiz(job.userId, job.recordId).get();
    if (!recordSnap.exists) {
      throw new Error(`Pending diagram quiz ${job.recordId} not found`);
    }

    const recordData = recordSnap.data() as { generationStatus?: string };
    if (recordData.generationStatus === 'completed') {
      logger.info('Skipping terminal diagram quiz generation record', {
        userId: job.userId,
        jobId: job.id,
        diagramQuizId: job.recordId,
      });
      return;
    }

    if (recordData.generationStatus === 'failed') {
      throw new Error(`Pending diagram quiz ${job.recordId} is already failed`);
    }

    const payload = await GenerationJobPayloadStorage.readJson<ArtifactAgentJobPayload>(
      job.payloadStoragePath
    );

    const input: ArtifactAgentJobInput = {
      userId: job.userId,
      directoryId: job.directoryId,
      recordId: job.recordId,
      jobId: job.id,
      artifactKind: payload.artifactKind,
      payload,
    };

    logger.info('Starting artifact agent generation job', {
      userId: job.userId,
      jobId: job.id,
      artifactKind: payload.artifactKind,
      recordId: job.recordId,
    });

    await runArtifactAgentPipeline(input);

    await GenerationJobPayloadStorage.delete(job.payloadStoragePath).catch((error) => {
      logger.warn('Failed to delete artifact agent job payload after completion', {
        userId: job.userId,
        jobId: job.id,
        storagePath: job.payloadStoragePath,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}
