import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { createHash, randomUUID } from 'crypto';
import type { GenerateSlideDeckRequest, Slide } from '@shared-types';
import { RuleApplicability } from '@shared-types';
import { DocumentCrudService } from '../document-crud';
import { completePendingSlideDeck } from '../artifact-generation-records';
import { GenerationJob } from '../generation-jobs';
import { GenerationJobPayloadStorage } from '../generation-job-payload-storage';
import { LlmGenerationService, resolveSlideDeckGenerationAudit } from '../llm';
import { isRuleResolutionMode, resolveEffectiveRules } from '../rule-resolution';

const redactId = (id: string): string =>
  createHash('sha256').update(id).digest('hex').slice(0, 8);

export class SlideDeckGenerationProcessor {
  static async process(job: GenerationJob): Promise<void> {
    const deckSnap = await admin
      .firestore()
      .collection('users')
      .doc(job.userId)
      .collection('slideDecks')
      .doc(job.recordId)
      .get();

    if (!deckSnap.exists) {
      throw new Error(`Pending slide deck ${job.recordId} not found`);
    }

    const deckData = deckSnap.data() as { generationStatus?: string };
    if (deckData.generationStatus === 'completed') {
      logger.info('Skipping terminal slide deck generation record', {
        userId: job.userId,
        jobId: job.id,
        slideDeckId: job.recordId,
      });
      return;
    }

    if (deckData.generationStatus === 'failed') {
      throw new Error(`Pending slide deck ${job.recordId} is already failed`);
    }

    const requestData = await GenerationJobPayloadStorage.readJson<GenerateSlideDeckRequest>(
      job.payloadStoragePath
    );

    const documentIds = requestData.documentIds;
    const uploadedPaths: string[] = [];
    const u = redactId(job.userId);

    try {
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

      let injectedRules: string | undefined;
      let appliedRuleIdsForSave: string[] = [];
      const explicitRuleIds = requestData.ruleIds?.length
        ? requestData.ruleIds
        : requestData.additionalRuleIds;
      const mode = requestData.ruleResolutionMode
        ?? (requestData.ruleIds?.length ? 'explicit-only' : 'inherit-plus-explicit');
      const { text: rulesText, ruleIds: resolvedAppliedIds } = await resolveEffectiveRules({
        userId: job.userId,
        directoryId: job.directoryId,
        operation: RuleApplicability.SLIDE_DECK,
        additionalRuleIds: explicitRuleIds,
        mode: isRuleResolutionMode(mode) ? mode : 'inherit-plus-explicit',
      });
      appliedRuleIdsForSave = resolvedAppliedIds;
      const base = requestData.additionalPrompt?.trim() || '';
      if (rulesText && base) {
        injectedRules = `${rulesText}\n\n${base}`;
      } else if (rulesText) {
        injectedRules = rulesText;
      } else if (base) {
        injectedRules = base;
      }

      const slideOutline = await LlmGenerationService.generateSlideDeckOutline(
        job.userId,
        combinedContent,
        requestData.additionalPrompt || undefined,
        injectedRules
      );

      const CONCURRENCY = 3;
      const slides: Slide[] = slideOutline.map((outline) => ({
        id: admin.firestore().collection('tmp').doc().id,
        title: outline.title,
        content: outline.content,
        speakerNotes: outline.speakerNotes,
      }));

      for (let batch = 0; batch < slides.length; batch += CONCURRENCY) {
        const chunk = slides.slice(batch, batch + CONCURRENCY);

        await Promise.all(chunk.map(async (slide, ci) => {
          const i = batch + ci;
          // Per-image rate limiting is intentionally skipped here: the deck-level
          // rate limit (slideDeckText, enforced at callable entry) already gates
          // user-initiated requests. A per-image cooldown would make batched
          // generation of 6-7 slides impossible within a single job.
          const brief = await LlmGenerationService.generateSlideImageBrief(
            job.userId,
            slide.title,
            slide.content,
            injectedRules
          );

          let imageBase64: string | null = null;
          if (brief) {
            const { SlideDeckPromptBuilder } = await import('../gemini/prompt-builder/slide-deck');
            const imagePrompt = SlideDeckPromptBuilder.buildSlideImageFromBriefPrompt(brief);
            imageBase64 = await LlmGenerationService.generateSlideImageFromPrompt(job.userId, imagePrompt);
          }
          if (!imageBase64) {
            imageBase64 = await LlmGenerationService.generateSlideImage(
              job.userId,
              slide.title,
              slide.content,
              injectedRules
            );
          }

          if (imageBase64) {
            const storagePath = `users/${job.userId}/slideDecks/${slide.id}/slide-${i}.png`;
            const downloadToken = randomUUID();
            const file = admin.storage().bucket().file(storagePath);
            await file.save(Buffer.from(imageBase64, 'base64'), {
              metadata: {
                contentType: 'image/png',
                metadata: { firebaseStorageDownloadTokens: downloadToken },
              },
              resumable: false,
            });
            slide.imageStoragePath = storagePath;
            slide.imageDownloadToken = downloadToken;
            uploadedPaths.push(storagePath);
          }
        }));
      }

      const finalTitle = requestData.title?.trim()
        || (documentIds.length === 1
          ? `Slides for "${documentDataList[0].title}"`
          : `Slides for "${documentDataList[0].title}" + ${documentIds.length - 1} more`);

      const { generationModel, generationModelUsage } = await resolveSlideDeckGenerationAudit(job.userId);

      await completePendingSlideDeck(job.userId, job.recordId, {
        title: finalTitle,
        slides,
        appliedRuleIds: appliedRuleIdsForSave,
        generationModel,
        generationModelUsage,
      });

      logger.info('Slide deck generation completed', {
        userIdHash: u,
        slideDeckId: job.recordId,
        jobId: job.id,
      });

      await GenerationJobPayloadStorage.delete(job.payloadStoragePath).catch(() => {/* best-effort */});
    } catch (error) {
      if (uploadedPaths.length > 0) {
        const bucket = admin.storage().bucket();
        await Promise.allSettled(
          uploadedPaths.map((p) => bucket.file(p).delete().catch(() => {/* ignore */}))
        );
      }
      throw error;
    }
  }
}
