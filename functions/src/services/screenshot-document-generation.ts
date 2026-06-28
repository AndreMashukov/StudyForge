import { logger } from 'firebase-functions/v2';
import type { GenerateFromScreenshotRequest } from '@shared-types';
import { directoryService } from './directory';
import { GenerationJobPayloadStorage } from './generation-job-payload-storage';
import { GenerationJobsService } from './generation-jobs';
import { enqueueGenerationJobTask } from './generation-task-queue';

const MAX_SCREENSHOT_BASE64_LENGTH = 14_000_000;

export interface ScreenshotEnqueueInput extends GenerateFromScreenshotRequest {
  userId: string;
  pendingDocumentId: string;
}

export interface ScreenshotEnqueueResult {
  success: boolean;
  id: string;
  documentId: string;
  recordType: 'document';
  directoryId: string;
  generationStatus: 'pending';
  title?: string;
}

export class ScreenshotDocumentGenerationService {
  static async enqueue(input: ScreenshotEnqueueInput): Promise<ScreenshotEnqueueResult> {
    this.validateInput(input);

    const userId = input.userId;
    const directoryId = input.directoryId.trim();

    await directoryService.validateDirectoryId(userId, directoryId);

    const jobId = GenerationJobsService.newJobId(userId);
    const payloadStoragePath = await GenerationJobPayloadStorage.saveJson(userId, jobId, {
      imageBase64: input.imageBase64,
      directoryId,
      title: input.title,
      prompt: input.prompt,
      ruleIds: input.ruleIds,
      ruleResolutionMode: input.ruleResolutionMode,
    });

    await GenerationJobsService.createJob({
      jobId,
      kind: 'documentFromScreenshot',
      userId,
      directoryId,
      recordId: input.pendingDocumentId,
      payloadStoragePath,
    });

    await enqueueGenerationJobTask({ userId, jobId });

    logger.info('Screenshot document generation queued', {
      userId,
      jobId,
      documentId: input.pendingDocumentId,
      directoryId,
    });

    return {
      success: true,
      id: input.pendingDocumentId,
      documentId: input.pendingDocumentId,
      recordType: 'document',
      directoryId,
      generationStatus: 'pending',
      title: input.title,
    };
  }

  private static validateInput(input: ScreenshotEnqueueInput): void {
    if (!input.userId || typeof input.userId !== 'string') {
      throw new Error('userId is required');
    }

    if (!input.pendingDocumentId || typeof input.pendingDocumentId !== 'string') {
      throw new Error('pendingDocumentId is required');
    }

    if (!input.imageBase64 || typeof input.imageBase64 !== 'string') {
      throw new Error('imageBase64 is required and must be a base64-encoded string');
    }

    if (input.imageBase64.length > MAX_SCREENSHOT_BASE64_LENGTH) {
      throw new Error('Image too large. Maximum 10MB base64-encoded.');
    }

    if (!input.directoryId || typeof input.directoryId !== 'string' || !input.directoryId.trim()) {
      throw new Error('directoryId is required');
    }

    if (input.ruleIds && !Array.isArray(input.ruleIds)) {
      throw new Error('ruleIds must be an array');
    }
  }
}
