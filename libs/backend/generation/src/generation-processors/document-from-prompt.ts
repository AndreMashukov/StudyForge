import { logger } from 'firebase-functions/v2';
import {
  GenerateFromPromptRequest,
  IDocumentAgentJobPayload,
} from '@shared-types';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { runPromptDocumentGeneration } from '@study-forge/backend-documents/direct-document-generation';
import { GenerationJob } from '../generation-jobs';
import { GenerationJobPayloadStorage } from '../generation-job-payload-storage';

export class DocumentFromPromptGenerationProcessor {
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
        generationStatus: documentData.generationStatus,
      });
      return;
    }

    if (documentData.generationStatus === 'failed') {
      throw new Error(`Pending document ${job.recordId} is already failed`);
    }

    const data = await GenerationJobPayloadStorage.readJson<
      GenerateFromPromptRequest & IDocumentAgentJobPayload
    >(job.payloadStoragePath);

    const payload: IDocumentAgentJobPayload =
      data.sourceKind != null
        ? data
        : {
            sourceKind: 'prompt',
            prompt: data.prompt,
            files: data.files,
            ruleIds: data.ruleIds,
            ruleResolutionMode: data.ruleResolutionMode,
          };

    logger.info('Starting async prompt document generation', {
      userId: job.userId,
      jobId: job.id,
      documentId: job.recordId,
      promptLength: payload.prompt?.trim().length ?? 0,
    });

    await runPromptDocumentGeneration(job, payload);

    await GenerationJobPayloadStorage.delete(job.payloadStoragePath).catch((error) => {
      logger.warn('Failed to delete generation job payload after completion', {
        userId: job.userId,
        jobId: job.id,
        storagePath: job.payloadStoragePath,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}
