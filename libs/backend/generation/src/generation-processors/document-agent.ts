import type { IDocumentAgentJobPayload } from '@shared-types';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { logger } from 'firebase-functions/v2';
import { runDocumentAgentPipeline } from '@study-forge/backend-documents/document-agent/document-agent-runner';
import { GenerationJobPayloadStorage } from '../generation-job-payload-storage';
import type { GenerationJob } from '../generation-jobs';

export class DocumentAgentGenerationProcessor {
  static async process(job: GenerationJob): Promise<void> {
    const documentSnap = await FirestorePaths.document(job.userId, job.recordId).get();
    if (!documentSnap.exists) {
      throw new Error(`Pending document ${job.recordId} not found`);
    }

    const documentData = documentSnap.data() as { generationStatus?: string };
    if (documentData.generationStatus === 'completed') {
      logger.info('Skipping terminal document generation record', {
        userId: job.userId,
        jobId: job.id,
        documentId: job.recordId,
      });
      return;
    }

    if (documentData.generationStatus === 'failed') {
      throw new Error(`Pending document ${job.recordId} is already failed`);
    }

    const payload = await GenerationJobPayloadStorage.readJson<IDocumentAgentJobPayload>(
      job.payloadStoragePath
    );

    await runDocumentAgentPipeline(job, payload);

    await GenerationJobPayloadStorage.delete(job.payloadStoragePath).catch((error) => {
      logger.warn('Failed to delete document agent job payload after completion', {
        userId: job.userId,
        jobId: job.id,
        storagePath: job.payloadStoragePath,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}
