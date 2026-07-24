import { logger } from 'firebase-functions/v2';
import { RuleApplicability } from '@shared-types';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import { FirestoreService } from '@study-forge/backend-artifacts/firestore';
import { GeminiService } from '@study-forge/backend-llm/gemini';
import { completePendingSequenceQuiz } from '@study-forge/backend-artifacts/artifact-generation-records';
import { GenerationJob } from '../generation-jobs';
import { GenerationJobPayloadStorage } from '../generation-job-payload-storage';
import { LlmGenerationService, resolveTextGenerationAudit } from '@study-forge/backend-llm/llm';
import { isRuleResolutionMode, resolveEffectiveRules } from '@study-forge/backend-directories/rule-resolution';

interface SequenceQuizJobPayload {
  documentIds: string[];
  sequenceQuizName?: string;
  additionalPrompt?: string;
  ruleIds?: string[];
  followupRuleIds?: string[];
  additionalRuleIds?: string[];
  ruleResolutionMode?: unknown;
}

export class SequenceQuizGenerationProcessor {
  static async process(job: GenerationJob): Promise<void> {
    const quizSnap = await FirestorePaths.sequenceQuiz(job.userId, job.recordId).get();
    if (!quizSnap.exists) {
      throw new Error(`Pending sequence quiz ${job.recordId} not found`);
    }

    const quizData = quizSnap.data() as { generationStatus?: string };
    if (quizData.generationStatus === 'completed') {
      logger.info('Skipping terminal sequence quiz generation record', {
        userId: job.userId,
        jobId: job.id,
        sequenceQuizId: job.recordId,
      });
      return;
    }

    if (quizData.generationStatus === 'failed') {
      throw new Error(`Pending sequence quiz ${job.recordId} is already failed`);
    }

    const requestData = await GenerationJobPayloadStorage.readJson<SequenceQuizJobPayload>(
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

    let enhancedPrompt = requestData.additionalPrompt || '';
    let followupIdsForSave: string[] = [];

    const hasExplicitRules = Boolean(requestData.ruleIds?.length || requestData.followupRuleIds?.length);
    const mode = isRuleResolutionMode(requestData.ruleResolutionMode)
      ? requestData.ruleResolutionMode
      : (hasExplicitRules ? 'explicit-only' : 'inherit-plus-explicit');

    const { text: quizRulesText, ruleIds: appliedRuleIdsForSave } = await resolveEffectiveRules({
      userId: job.userId,
      directoryId: job.directoryId,
      operation: RuleApplicability.SEQUENCE_QUIZ,
      additionalRuleIds: requestData.ruleIds?.length ? requestData.ruleIds : requestData.additionalRuleIds,
      mode,
    });
    if (quizRulesText) {
      enhancedPrompt = `${quizRulesText}\n\n${enhancedPrompt}`;
    }

    const { ruleIds: resolvedFollowupIds } = await resolveEffectiveRules({
      userId: job.userId,
      directoryId: job.directoryId,
      operation: RuleApplicability.FOLLOWUP,
      additionalRuleIds: hasExplicitRules ? (requestData.followupRuleIds || []) : requestData.additionalRuleIds,
      mode,
    });
    followupIdsForSave = resolvedFollowupIds;

    const geminiQuiz = await LlmGenerationService.generateSequenceQuiz(
      job.userId,
      documentContent,
      enhancedPrompt || undefined
    );

    const finalTitle = requestData.sequenceQuizName
      || (documentIds.length === 1
        ? `Sequence Quiz from ${documentDataList[0].doc.title}`
        : `Sequence Quiz from ${documentDataList[0].doc.title} + ${documentIds.length - 1} more`);

    const { generationModel, generationModelUsage } = await resolveTextGenerationAudit(
      job.userId,
      'sequenceQuiz'
    );

    await completePendingSequenceQuiz(job.userId, job.recordId, {
      title: finalTitle,
      questions: geminiQuiz.questions,
      appliedRuleIds: appliedRuleIdsForSave,
      followupRuleIds: followupIdsForSave,
      generationModel,
      generationModelUsage,
    });

    await GenerationJobPayloadStorage.delete(job.payloadStoragePath).catch(() => {/* best-effort */});
  }
}
