import { logger } from 'firebase-functions/v2';
import type { IDocumentFromScreenshotJobPayload } from '@shared-types';
import { RuleApplicability } from '@shared-types';
import { FirestorePaths } from '../../lib/firestore-paths';
import { DocumentCrudService } from '../document-crud';
import {
  LlmGenerationRouteResolver,
  LlmGenerationService,
  formatGenerationModelLabel,
  toGenerationModelUsage,
} from '../llm';
import { GenerationJob } from '../generation-jobs';
import { GenerationJobPayloadStorage } from '../generation-job-payload-storage';
import { isRuleResolutionMode, resolveEffectiveRules } from '../rule-resolution';

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

    const data = await GenerationJobPayloadStorage.readJson<IDocumentFromScreenshotJobPayload>(
      job.payloadStoragePath
    );

    const routeResolution = await LlmGenerationRouteResolver.resolve('documentFromScreenshot', {
      userId: job.userId,
    });

    if (routeResolution.workflow !== 'direct') {
      throw new Error(
        `documentFromScreenshot workflow ${routeResolution.workflow} is not supported in Task 14 (direct only).`
      );
    }

    const mode = data.ruleIds?.length
      ? isRuleResolutionMode(data.ruleResolutionMode)
        ? data.ruleResolutionMode
        : 'explicit-only'
      : 'inherit';

    const { text: rulesText, ruleIds: effectiveRuleIds } = await resolveEffectiveRules({
      userId: job.userId,
      directoryId: job.directoryId,
      operation: RuleApplicability.PROMPT,
      additionalRuleIds: data.ruleIds || data.additionalRuleIds || [],
      mode,
    });

    if (rulesText) {
      logger.info('Injecting effective rules into async screenshot document generation', {
        ruleCount: effectiveRuleIds.length,
        userId: job.userId,
        mode,
      });
    }

    const startMs = Date.now();
    const generatedContent = await LlmGenerationService.generateDocumentFromScreenshot(
      job.userId,
      data.imageBase64,
      data.prompt,
      rulesText || undefined
    );
    const durationMs = Date.now() - startMs;

    const title = resolveScreenshotTitle({
      generatedContent,
      title: data.title,
      prompt: data.prompt,
    });

    const generationModel = formatGenerationModelLabel(routeResolution.route);
    const generationModelUsage = [
      toGenerationModelUsage(routeResolution, durationMs),
    ];

    await DocumentCrudService.completePendingDocument(job.userId, job.recordId, generatedContent, {
      title,
      description: 'Captured from screenshot',
      tags: ['screenshot', 'captured'],
      appliedRuleIds: effectiveRuleIds,
      generationModel,
      generationModelUsage,
    });

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

function resolveScreenshotTitle({
  generatedContent,
  title,
  prompt,
}: {
  generatedContent: string;
  title?: string;
  prompt?: string;
}): string {
  if (title?.trim()) {
    return title.trim();
  }

  const titleMatch = generatedContent.match(/^#\s+(.+)$/m);
  if (titleMatch?.[1]) {
    return titleMatch[1].trim();
  }

  if (prompt?.trim()) {
    const trimmedPrompt = prompt.trim();
    return trimmedPrompt.length > 50 ? `${trimmedPrompt.substring(0, 50)}...` : trimmedPrompt;
  }

  return 'Captured Document';
}
