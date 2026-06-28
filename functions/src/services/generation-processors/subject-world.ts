import { logger } from 'firebase-functions/v2';
import { RuleApplicability } from '@shared-types';
import { FirestorePaths } from '../../lib/firestore-paths';
import { DocumentCrudService } from '../document-crud';
import { FirestoreService } from '../firestore';
import { GeminiService } from '../gemini';
import { completePendingSubjectWorld } from '../artifact-generation-records';
import { normalizeSubjectWorldSpec } from '../subject-world-normalizer';
import { GenerationJob } from '../generation-jobs';
import { GenerationJobPayloadStorage } from '../generation-job-payload-storage';
import { LlmGenerationService, resolveTextGenerationAudit } from '../llm';
import { isRuleResolutionMode, resolveEffectiveRules } from '../rule-resolution';

interface SubjectWorldJobPayload {
  documentIds: string[];
  subjectWorldName?: string;
  additionalPrompt?: string;
  ruleIds?: string[];
  followupRuleIds?: string[];
  additionalRuleIds?: string[];
  ruleResolutionMode?: unknown;
}

export class SubjectWorldGenerationProcessor {
  static async process(job: GenerationJob): Promise<void> {
    const worldSnap = await FirestorePaths.subjectWorld(job.userId, job.recordId).get();
    if (!worldSnap.exists) {
      throw new Error(`Pending subject world ${job.recordId} not found`);
    }

    const worldData = worldSnap.data() as { generationStatus?: string };
    if (worldData.generationStatus === 'completed') {
      logger.info('Skipping terminal subject world generation record', {
        userId: job.userId,
        jobId: job.id,
        subjectWorldId: job.recordId,
      });
      return;
    }

    if (worldData.generationStatus === 'failed') {
      throw new Error(`Pending subject world ${job.recordId} is already failed`);
    }

    const requestData = await GenerationJobPayloadStorage.readJson<SubjectWorldJobPayload>(
      job.payloadStoragePath
    );

    const documentIds = requestData.documentIds;
    const documentDataList = await Promise.all(
      documentIds.map(async (docId) => {
        const doc = await DocumentCrudService.getDocument(job.userId, docId);
        const content = await FirestoreService.getDocumentContent(job.userId, docId);
        return { doc, content };
      })
    );

    const combinedContent = documentDataList.map((d) => d.content).join('\n\n---\n\n');
    const combinedWordCount = combinedContent.split(/\s+/).length;
    const combinedTitle = documentDataList.map((d) => d.doc.title).join(' + ');

    const documentContent = {
      title: combinedTitle,
      content: combinedContent,
      wordCount: combinedWordCount,
    };

    GeminiService.validateContentForQuiz(documentContent);

    const pendingTitle = requestData.subjectWorldName
      || (documentIds.length === 1
        ? `Subject World: ${documentDataList[0].doc.title}`
        : `Subject World: ${documentDataList[0].doc.title} + ${documentIds.length - 1} more`);

    let enhancedPrompt = requestData.additionalPrompt || '';
    let followupIdsForSave: string[] = [];

    const hasExplicitRules = Boolean(requestData.ruleIds?.length || requestData.followupRuleIds?.length);
    const mode = isRuleResolutionMode(requestData.ruleResolutionMode)
      ? requestData.ruleResolutionMode
      : (hasExplicitRules ? 'explicit-only' : 'inherit-plus-explicit');

    const { text: worldRulesText, ruleIds: appliedRuleIdsForSave } = await resolveEffectiveRules({
      userId: job.userId,
      directoryId: job.directoryId,
      operation: RuleApplicability.SUBJECT_WORLD,
      additionalRuleIds: requestData.ruleIds?.length ? requestData.ruleIds : requestData.additionalRuleIds,
      mode,
    });
    if (worldRulesText) {
      enhancedPrompt = `${worldRulesText}\n\n${enhancedPrompt}`;
    }

    const { ruleIds: resolvedFollowupIds } = await resolveEffectiveRules({
      userId: job.userId,
      directoryId: job.directoryId,
      operation: RuleApplicability.FOLLOWUP,
      additionalRuleIds: hasExplicitRules ? (requestData.followupRuleIds || []) : requestData.additionalRuleIds,
      mode,
    });
    followupIdsForSave = resolvedFollowupIds;

    const rawSpec = await LlmGenerationService.generateSubjectWorld(
      job.userId,
      documentContent,
      documentIds,
      enhancedPrompt || undefined
    );

    const worldSpec = normalizeSubjectWorldSpec(rawSpec, documentIds, pendingTitle);
    const finalTitle = requestData.subjectWorldName || worldSpec.title || pendingTitle;

    const { generationModel, generationModelUsage } = await resolveTextGenerationAudit(
      job.userId,
      'subjectWorld'
    );

    await completePendingSubjectWorld(job.userId, job.recordId, {
      title: finalTitle,
      worldSpec,
      appliedRuleIds: appliedRuleIdsForSave,
      followupRuleIds: followupIdsForSave,
      generationModel,
      generationModelUsage,
    });

    await GenerationJobPayloadStorage.delete(job.payloadStoragePath).catch(() => {/* best-effort */});
  }
}
