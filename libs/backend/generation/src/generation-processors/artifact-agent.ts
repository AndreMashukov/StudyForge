import { logger } from 'firebase-functions/v2';
import type { GenerationStatus } from '@shared-types';
import { GenerationJob } from '../generation-jobs';
import { GenerationJobPayloadStorage } from '../generation-job-payload-storage';
import {
  ArtifactAgentJobInput,
  ArtifactAgentJobPayload,
  runArtifactAgentPipeline,
} from '@study-forge/backend-artifacts/artifact-agent';
import {
  isArtifactKind,
  recordRefForArtifactKind,
} from '@study-forge/backend-artifacts/artifact-agent/artifact-agent-record-paths';

interface ArtifactRecordGenerationState {
  generationStatus?: GenerationStatus;
}

function isArtifactRecordGenerationState(
  value: unknown
): value is ArtifactRecordGenerationState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (record.generationStatus === undefined) {
    return true;
  }

  return (
    record.generationStatus === 'pending'
    || record.generationStatus === 'completed'
    || record.generationStatus === 'failed'
  );
}

export class ArtifactAgentGenerationProcessor {
  static async process(job: GenerationJob): Promise<void> {
    const payload = await GenerationJobPayloadStorage.readJson<ArtifactAgentJobPayload>(
      job.payloadStoragePath
    );

    const artifactKind = job.artifactKind ?? payload.artifactKind;
    if (!isArtifactKind(artifactKind)) {
      throw new Error(`Invalid artifact kind for artifact agent job ${job.id}`);
    }

    const recordSnap = await recordRefForArtifactKind(
      job.userId,
      artifactKind,
      job.recordId
    ).get();
    if (!recordSnap.exists) {
      throw new Error(`Pending ${artifactKind} record ${job.recordId} not found`);
    }

    const recordData = recordSnap.data();
    if (!isArtifactRecordGenerationState(recordData)) {
      throw new Error(`Pending ${artifactKind} record ${job.recordId} has invalid data`);
    }

    if (recordData.generationStatus === 'completed') {
      logger.info('Skipping terminal artifact agent generation record', {
        userId: job.userId,
        jobId: job.id,
        artifactKind,
        recordId: job.recordId,
      });
      return;
    }

    if (recordData.generationStatus === 'failed') {
      throw new Error(`Pending ${artifactKind} record ${job.recordId} is already failed`);
    }

    const input: ArtifactAgentJobInput = {
      userId: job.userId,
      directoryId: job.directoryId,
      recordId: job.recordId,
      jobId: job.id,
      artifactKind,
      payload: {
        ...payload,
        artifactKind,
      },
    };

    logger.info('Starting artifact agent generation job', {
      userId: job.userId,
      jobId: job.id,
      artifactKind,
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
