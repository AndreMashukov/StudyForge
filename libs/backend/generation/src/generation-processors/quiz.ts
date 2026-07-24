import { logger } from 'firebase-functions/v2';
import type { GenerateQuizRequest } from '@shared-types';
import { RuleApplicability, getDocumentFallbackColor } from '@shared-types';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import { FirestoreService } from '@study-forge/backend-artifacts/firestore';
import { GeminiService } from '@study-forge/backend-llm/gemini';
import {
  completePendingQuiz,
  failPendingQuiz,
} from '@study-forge/backend-artifacts/artifact-generation-records';
import { GenerationJob } from '../generation-jobs';
import { GenerationJobPayloadStorage } from '../generation-job-payload-storage';
import { LlmGenerationService, resolveTextGenerationAudit } from '@study-forge/backend-llm/llm';
import { isRuleResolutionMode, resolveEffectiveRules } from '@study-forge/backend-directories/rule-resolution';

export class QuizGenerationProcessor {
  static async process(job: GenerationJob): Promise<void> {
    const quizSnap = await FirestorePaths.quiz(job.userId, job.recordId).get();
    if (!quizSnap.exists) {
      throw new Error(`Pending quiz ${job.recordId} not found`);
    }

    const quizData = quizSnap.data() as { generationStatus?: string };
    if (quizData.generationStatus === 'completed') {
      logger.info('Skipping terminal quiz generation record', {
        userId: job.userId,
        jobId: job.id,
        quizId: job.recordId,
      });
      return;
    }

    if (quizData.generationStatus === 'failed') {
      throw new Error(`Pending quiz ${job.recordId} is already failed`);
    }

    const requestData = await GenerationJobPayloadStorage.readJson<GenerateQuizRequest & {
      ruleResolutionMode?: unknown;
    }>(job.payloadStoragePath);

    const documentIds = requestData.documentIds;
    if (!documentIds?.length) {
      throw new Error('documentIds is required');
    }

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
    let appliedRuleIdsForSave: string[] = [];

    const ruleResolutionMode = isRuleResolutionMode(requestData.ruleResolutionMode)
      ? requestData.ruleResolutionMode
      : undefined;
    const hasLegacyExplicitRules = Boolean(
      requestData.ruleIds?.length || requestData.quizRuleIds?.length || requestData.followupRuleIds?.length
    );
    const mode = ruleResolutionMode
      ?? (hasLegacyExplicitRules ? 'explicit-only' : 'inherit-plus-explicit');
    const selectedQuizRuleIds = requestData.ruleIds?.length
      ? requestData.ruleIds
      : requestData.quizRuleIds?.length
        ? requestData.quizRuleIds
        : requestData.additionalRuleIds;
    const selectedFollowupRuleIds = hasLegacyExplicitRules
      ? (requestData.followupRuleIds || [])
      : requestData.additionalRuleIds;

    const { text: quizRulesText, ruleIds: resolvedAppliedIds } = await resolveEffectiveRules({
      userId: job.userId,
      directoryId: job.directoryId,
      operation: RuleApplicability.QUIZ,
      additionalRuleIds: selectedQuizRuleIds,
      mode,
    });
    if (quizRulesText) {
      enhancedPrompt = `${quizRulesText}\n\n${enhancedPrompt}`;
    }
    appliedRuleIdsForSave = resolvedAppliedIds;

    const { ruleIds: resolvedFollowupIds } = await resolveEffectiveRules({
      userId: job.userId,
      directoryId: job.directoryId,
      operation: RuleApplicability.FOLLOWUP,
      additionalRuleIds: selectedFollowupRuleIds,
      mode,
    });
    followupIdsForSave = resolvedFollowupIds;

    const geminiQuiz = await LlmGenerationService.generateQuiz(
      job.userId,
      documentContent,
      enhancedPrompt
    );

    let title = geminiQuiz.title;
    if (requestData.quizName?.trim()) {
      title = requestData.quizName.trim();
    } else if (documentIds.length === 1) {
      title = `Quiz from ${documentDataList[0].doc.title}`;
    } else {
      title = `Quiz from ${documentDataList[0].doc.title} + ${documentIds.length - 1} more`;
    }

    const existingSnap = await FirestorePaths.quizzes(job.userId)
      .where('documentId', '==', documentIds[0])
      .get();
    const generationAttempt = existingSnap.size;

    const { generationModel, generationModelUsage } = await resolveTextGenerationAudit(job.userId, 'quiz');

    await completePendingQuiz(job.userId, job.recordId, {
      title,
      questions: geminiQuiz.questions.map((q) => ({
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        ...(q.hint ? { hint: q.hint } : {}),
        ...(q.knowledge ? { knowledge: q.knowledge } : {}),
      })),
      appliedRuleIds: appliedRuleIdsForSave,
      generationAttempt,
      generationModel,
      generationModelUsage,
    });

    await FirestorePaths.quiz(job.userId, job.recordId).update({
      followupRuleIds: followupIdsForSave,
      documentTitle: documentDataList[0].doc.title,
    });

    await GenerationJobPayloadStorage.delete(job.payloadStoragePath).catch(() => {/* best-effort */});
  }
}
