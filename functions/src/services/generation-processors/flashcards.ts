import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import type { GenerateFlashcardsRequest, Flashcard } from '@shared-types';
import { RuleApplicability, getDocumentFallbackColor } from '@shared-types';
import { DocumentCrudService } from '../document-crud';
import {
  completePendingFlashcardSet,
} from '../artifact-generation-records';
import { GenerationJob } from '../generation-jobs';
import { GenerationJobPayloadStorage } from '../generation-job-payload-storage';
import { LlmGenerationService } from '../llm';
import { isRuleResolutionMode, resolveEffectiveRules } from '../rule-resolution';

export class FlashcardsGenerationProcessor {
  static async process(job: GenerationJob): Promise<void> {
    const flashcardSnap = await admin
      .firestore()
      .collection('users')
      .doc(job.userId)
      .collection('flashcardSets')
      .doc(job.recordId)
      .get();

    if (!flashcardSnap.exists) {
      throw new Error(`Pending flashcard set ${job.recordId} not found`);
    }

    const flashcardData = flashcardSnap.data() as { generationStatus?: string };
    if (flashcardData.generationStatus === 'completed') {
      logger.info('Skipping terminal flashcard generation record', {
        userId: job.userId,
        jobId: job.id,
        flashcardSetId: job.recordId,
      });
      return;
    }

    if (flashcardData.generationStatus === 'failed') {
      throw new Error(`Pending flashcard set ${job.recordId} is already failed`);
    }

    const parseResult = await GenerationJobPayloadStorage.readJson<GenerateFlashcardsRequest>(
      job.payloadStoragePath
    );

    const documentIds = parseResult.documentIds;
    const documentDataList = await Promise.all(
      documentIds.map(async (docId) => {
        const doc = await DocumentCrudService.getDocumentWithContent(job.userId, docId);
        if (!doc?.content) {
          throw new Error(`Document ${docId} does not exist or has no content`);
        }
        return doc;
      })
    );

    const combinedContent = documentDataList.map((d) => d.content).join('\n\n---\n\n');
    const combinedTitle = documentDataList.map((d) => d.title).join(' + ');

    let injectedRules: string | undefined;
    let appliedRuleIdsForSave: string[] = [];
    let appliedDescriptionRuleIdsForSave: string[] = [];

    const explicitRuleIds = parseResult.ruleIds?.length
      ? parseResult.ruleIds
      : parseResult.additionalRuleIds;
    const mode = parseResult.ruleResolutionMode
      ?? (parseResult.ruleIds?.length ? 'explicit-only' : 'inherit-plus-explicit');
    const resolvedMode = isRuleResolutionMode(mode) ? mode : 'inherit-plus-explicit';

    const { text: rulesText, ruleIds: resolvedAppliedIds } = await resolveEffectiveRules({
      userId: job.userId,
      directoryId: job.directoryId,
      operation: RuleApplicability.FLASHCARD,
      additionalRuleIds: explicitRuleIds,
      mode: resolvedMode,
    });
    appliedRuleIdsForSave = resolvedAppliedIds;

    const base = parseResult.additionalPrompt?.trim()
      ? `Additional instructions: ${parseResult.additionalPrompt}`
      : '';
    if (rulesText && base) {
      injectedRules = `${rulesText}\n\n${base}`;
    } else if (rulesText) {
      injectedRules = rulesText;
    } else if (base) {
      injectedRules = base;
    }

    const selectedDescriptionRuleIds = parseResult.descriptionRuleIds?.length
      ? parseResult.descriptionRuleIds
      : explicitRuleIds;
    const { text: descRulesText, ruleIds: resolvedDescriptionRuleIds } = await resolveEffectiveRules({
      userId: job.userId,
      directoryId: job.directoryId,
      operation: RuleApplicability.FLASHCARD_DESC,
      additionalRuleIds: selectedDescriptionRuleIds,
      mode: resolvedMode,
    });
    appliedDescriptionRuleIdsForSave = resolvedDescriptionRuleIds;

    const {
      flashcards: generatedFlashcards,
      generationModel,
      generationModelUsage,
    } = await LlmGenerationService.generateFlashcards(
      job.userId,
      combinedContent,
      injectedRules,
      descRulesText || undefined
    );

    const flashcardsWithIds: Flashcard[] = generatedFlashcards.map((card) => ({
      ...card,
      id: admin.firestore().collection('tmp').doc().id,
    }));

    const finalTitle = parseResult.title?.trim()
      || (documentIds.length === 1
        ? `Flashcards for "${documentDataList[0].title}"`
        : `Flashcards for "${documentDataList[0].title}" + ${documentIds.length - 1} more`);

    await completePendingFlashcardSet(job.userId, job.recordId, {
      title: finalTitle,
      flashcards: flashcardsWithIds,
      appliedRuleIds: appliedRuleIdsForSave,
      appliedDescriptionRuleIds: appliedDescriptionRuleIdsForSave,
      generationModel,
      generationModelUsage,
    });

    await GenerationJobPayloadStorage.delete(job.payloadStoragePath).catch(() => {/* best-effort */});
  }
}
