import { logger } from 'firebase-functions/v2';
import {
  GenerateFromPromptRequest,
  RuleApplicability,
} from '@shared-types';
import { FirestorePaths } from '../../lib/firestore-paths';
import { DocumentCrudService } from '../document-crud';
import { LlmGenerationService } from '../llm';
import { GenerationJob } from '../generation-jobs';
import { GenerationJobPayloadStorage } from '../generation-job-payload-storage';
import { isRuleResolutionMode, resolveEffectiveRules } from '../rule-resolution';

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

    const data = await GenerationJobPayloadStorage.readJson<GenerateFromPromptRequest & {
      additionalRuleIds?: string[];
      ruleResolutionMode?: unknown;
    }>(job.payloadStoragePath);

    const trimmedPrompt = data.prompt.trim();
    const uploadFilesCount = data.files?.filter(f => f.source === 'upload' || !f.source).length || 0;
    const libraryFilesCount = data.files?.filter(f => f.source === 'library').length || 0;
    const mode = isRuleResolutionMode(data.ruleResolutionMode)
      ? data.ruleResolutionMode
      : (data.ruleIds?.length ? 'explicit-only' : 'inherit-plus-explicit');

    const { text: rulesText, ruleIds: effectiveRuleIds } = await resolveEffectiveRules({
      userId: job.userId,
      directoryId: job.directoryId,
      operation: RuleApplicability.PROMPT,
      additionalRuleIds: data.ruleIds?.length ? data.ruleIds : data.additionalRuleIds,
      mode,
    });

    if (rulesText) {
      logger.info('Injecting effective rules into async document generation prompt', {
        ruleCount: effectiveRuleIds.length,
        userId: job.userId,
        mode,
      });
    }

    logger.info('Starting async prompt document generation', {
      userId: job.userId,
      jobId: job.id,
      documentId: job.recordId,
      promptLength: trimmedPrompt.length,
      withContextFiles: !!(data.files && data.files.length > 0),
      contextSources: {
        hasUploadedFiles: uploadFilesCount > 0,
        hasLibraryDocuments: libraryFilesCount > 0,
        isMixedSource: uploadFilesCount > 0 && libraryFilesCount > 0,
      },
    });

    const generatedContent = await LlmGenerationService.generateDocumentFromPrompt(
      trimmedPrompt,
      data.files,
      rulesText || undefined
    );

    const titleMatch = generatedContent.match(/^#\s+(.+)$/m);
    const title = titleMatch?.[1]?.trim()
      || (trimmedPrompt.length > 50 ? `${trimmedPrompt.substring(0, 50)}...` : trimmedPrompt);
    const wordCount = generatedContent.split(/\s+/).length;

    if (wordCount < 1000) {
      logger.warn('Generated content below minimum word count', {
        userId: job.userId,
        jobId: job.id,
        documentId: job.recordId,
        wordCount,
        required: 1000,
      });
    }

    await DocumentCrudService.completePendingDocument(job.userId, job.recordId, generatedContent, {
      title,
      description: `Generated from prompt: ${trimmedPrompt.substring(0, 100)}${trimmedPrompt.length > 100 ? '...' : ''}`,
      tags: ['ai-generated', 'prompt-based'],
    });

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