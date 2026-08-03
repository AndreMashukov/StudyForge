import { logger } from 'firebase-functions/v2';
import type { IDocumentAgentJobPayload, IDocumentFromScreenshotJobPayload } from '@shared-types';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { runScreenshotDocumentGeneration } from '@study-forge/backend-documents/direct-document-generation';
import { GenerationJob } from '../generation-jobs';
import { GenerationJobPayloadStorage } from '../generation-job-payload-storage';

export class DocumentFromScreenshotGenerationProcessor {
  static async process(job: GenerationJob): Promise<void> {
    const documentSnap = await FirestorePaths.document(job.userId, job.recordId).get();
    if (!documentSnap.exists) {
      throw new Error(`Pending document ${job.recordId} not found`);
    }

    const documentData = documentSnap.data() as { generationStatus?: string };
    if (documentData.generationStatus === 'completed') {
      logger.info('Skipping terminal screenshot document generation record', {
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
      IDocumentFromScreenshotJobPayload & IDocumentAgentJobPayload
    >(job.payloadStoragePath);

    const payload: IDocumentAgentJobPayload =
      data.sourceKind != null
        ? data
        : {
            sourceKind: 'screenshot',
            imageBase64: data.imageBase64,
            prompt: data.prompt,
            title: data.title,
            ruleIds: data.ruleIds,
            additionalRuleIds: data.additionalRuleIds,
            ruleResolutionMode: data.ruleResolutionMode,
            sourceText: data.prompt
              ? `Screenshot capture with instructions: ${data.prompt}`
              : 'Screenshot capture',
          };

    logger.info('Starting async screenshot document generation', {
      userId: job.userId,
      jobId: job.id,
      documentId: job.recordId,
    });

    await runScreenshotDocumentGeneration(job, payload);

    await GenerationJobPayloadStorage.delete(job.payloadStoragePath).catch((error) => {
      logger.warn('Failed to delete screenshot generation job payload after completion', {
        userId: job.userId,
        jobId: job.id,
        storagePath: job.payloadStoragePath,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}
