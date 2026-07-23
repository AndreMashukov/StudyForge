import * as admin from 'firebase-admin';
import { RuleApplicability, canonicalizeBcp47LanguageCode } from '@shared-types';
import { FirestoreService } from '../firestore';
import { DocumentCrudService } from '../document-crud';
import { LlmGenerationService } from '../llm';
import { isRuleResolutionMode, resolveEffectiveRules } from '../rule-resolution';
import {
  completePendingFlashcardSet,
  failPendingFlashcardSet,
} from '../artifact-generation-records';
import type {
  ArtifactAgentDefinition,
  ArtifactAgentJobInput,
  ArtifactAgentResult,
  ArtifactAgentFailure,
} from '../artifact-agent/artifact-agent-definition';
import { recordModelUsage } from '../artifact-agent/artifact-agent-definition';
import { flashcardGates } from './flashcard-gates';
import { flashcardRepairStrategy } from './flashcard-repair';
import type { IFlashcardDraft, IFlashcardJobPayload } from './flashcard-types';
import { LANGUAGE_LEARNING_CONFIDENCE_THRESHOLD } from './flashcard-types';
import { listLearnedVocabularyTerms } from './learned-vocabulary';

const AGENT_DEFINITION_VERSION = 'flashcards-v1';

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value.filter((entry): entry is string => typeof entry === 'string');
  return items.length > 0 ? items : undefined;
}

async function loadFlashcardContext(
  input: ArtifactAgentJobInput<IFlashcardJobPayload>
): Promise<import('../artifact-agent/artifact-agent-definition').ArtifactAgentContext> {
  const payload = input.payload;
  const documentIds = payload.documentIds;
  if (!documentIds.length) {
    throw new Error('documentIds is required');
  }

  const documentDataList = await Promise.all(
    documentIds.map(async (docId) => {
      const doc = await DocumentCrudService.getDocument(input.userId, docId);
      const content = await FirestoreService.getDocumentContent(input.userId, docId);
      return { doc, content };
    })
  );

  const combinedContent = documentDataList.map((entry) => entry.content).join('\n\n---\n\n');
  const combinedTitle = documentDataList.map((entry) => entry.doc.title).join(' + ');
  const documentContent = {
    title: combinedTitle,
    content: combinedContent,
    wordCount: combinedContent.split(/\s+/).length,
  };

  let enhancedPrompt = payload.additionalPrompt || '';
  const hasLegacyExplicitRules = Boolean(payload.ruleIds?.length);
  const mode = isRuleResolutionMode(payload.ruleResolutionMode)
    ? payload.ruleResolutionMode
    : hasLegacyExplicitRules
      ? 'explicit-only'
      : 'inherit-plus-explicit';

  const selectedRuleIds = payload.ruleIds?.length
    ? payload.ruleIds
    : payload.additionalRuleIds;

  const { text: flashcardRulesText, ruleIds: appliedRuleIds } = await resolveEffectiveRules({
    userId: input.userId,
    directoryId: input.directoryId,
    operation: RuleApplicability.FLASHCARD,
    additionalRuleIds: selectedRuleIds,
    mode,
  });

  if (flashcardRulesText) {
    enhancedPrompt = `${flashcardRulesText}\n\n${enhancedPrompt}`.trim();
  }

  const selectedDescriptionRuleIds = payload.artifactPayload?.descriptionRuleIds?.length
    ? payload.artifactPayload.descriptionRuleIds
    : selectedRuleIds;

  const { text: descRulesText, ruleIds: appliedDescriptionRuleIds } = await resolveEffectiveRules({
    userId: input.userId,
    directoryId: input.directoryId,
    operation: RuleApplicability.FLASHCARD_DESC,
    additionalRuleIds: selectedDescriptionRuleIds,
    mode,
  });

  const pendingTitle =
    payload.title?.trim()
    || (documentIds.length === 1
      ? `Flashcards for "${documentDataList[0].doc.title}"`
      : `Flashcards for "${documentDataList[0].doc.title}" + ${documentIds.length - 1} more`);

  return {
    userId: input.userId,
    directoryId: input.directoryId,
    recordId: input.recordId,
    jobId: input.jobId,
    artifactKind: 'flashcards',
    documentIds,
    title: pendingTitle,
    enhancedPrompt,
    appliedRuleIds,
    followupRuleIds: [],
    sourceContent: documentContent,
    extras: {
      descriptionRulesText: descRulesText || '',
      appliedDescriptionRuleIds,
    },
  };
}

function isConfidentLanguageLearning(
  classification: IFlashcardDraft['classification']
): boolean {
  if (!classification.isLanguageLearning) {
    return false;
  }
  if (classification.confidence < LANGUAGE_LEARNING_CONFIDENCE_THRESHOLD) {
    return false;
  }
  if (!classification.targetLanguageName?.trim()) {
    return false;
  }

  const canonicalLanguageCode = canonicalizeBcp47LanguageCode(
    classification.targetLanguageCode ?? ''
  );
  if (!canonicalLanguageCode) {
    return false;
  }

  classification.targetLanguageCode = canonicalLanguageCode;
  return true;
}

export const flashcardsDefinition: ArtifactAgentDefinition<
  IFlashcardDraft,
  IFlashcardJobPayload
> = {
  artifactKind: 'flashcards',
  displayName: 'Flashcards',
  collection: 'flashcards',
  primaryCapability: 'flashcards',
  agentDefinitionVersion: AGENT_DEFINITION_VERSION,
  warningsBlockCompletion: false,

  loadContext: loadFlashcardContext,

  async generate(context, diagnostics) {
    const classifyStartedAt = Date.now();
    const classification = await LlmGenerationService.classifyFlashcardLanguageLearning(
      context.userId,
      context.sourceContent.content
    );
    recordModelUsage(diagnostics, {
      role: 'generator',
      capability: 'flashcards',
      durationMs: Date.now() - classifyStartedAt,
    });

    const confidentLanguageLearning = isConfidentLanguageLearning(classification);
    const languageCode = classification.targetLanguageCode?.trim().toLowerCase();
    const learnedTerms =
      confidentLanguageLearning && languageCode
        ? await listLearnedVocabularyTerms(context.userId, languageCode)
        : [];

    const descriptionRulesText =
      typeof context.extras?.descriptionRulesText === 'string'
        ? context.extras.descriptionRulesText
        : '';
    const appliedDescriptionRuleIds =
      readStringArray(context.extras?.appliedDescriptionRuleIds) ?? [];

    const generateStartedAt = Date.now();
    const {
      flashcards: cards,
      generationModel,
      generationModelUsage,
    } = await LlmGenerationService.generateFlashcards(
      context.userId,
      context.sourceContent.content,
      context.enhancedPrompt || undefined,
      descriptionRulesText || undefined,
      'flashcards',
      confidentLanguageLearning
        ? {
            isLanguageLearning: true,
            targetLanguageName: classification.targetLanguageName,
            learnedTerms,
          }
        : undefined
    );

    recordModelUsage(diagnostics, {
      role: 'generator',
      capability: 'flashcards',
      model: generationModel,
      durationMs: Date.now() - generateStartedAt,
    });

    return {
      flashcards: cards,
      classification: confidentLanguageLearning
        ? classification
        : {
            isLanguageLearning: false,
            confidence: classification.confidence,
          },
      appliedDescriptionRuleIds,
      generationModel,
      generationModelUsage,
    };
  },

  gates: flashcardGates,
  repair: flashcardRepairStrategy,

  async persistCompleted(result: ArtifactAgentResult<IFlashcardDraft>) {
    const { generationModel, generationModelUsage } = result.draft;

    const flashcardsWithIds = result.draft.flashcards.map((card) => {
      const term = card.term?.trim();
      const { term: _ignored, ...rest } = card;
      return {
        ...rest,
        ...(term ? { term } : {}),
        id: admin.firestore().collection('tmp').doc().id,
      };
    });

    const confident = isConfidentLanguageLearning(result.draft.classification);

    await completePendingFlashcardSet(result.context.userId, result.context.recordId, {
      title: result.context.title,
      flashcards: flashcardsWithIds,
      appliedRuleIds: result.context.appliedRuleIds,
      appliedDescriptionRuleIds: result.draft.appliedDescriptionRuleIds,
      generationModel,
      agentModel: generationModel,
      generationModelUsage,
      isLanguageLearning: confident,
      languageLearningConfidence: result.draft.classification.confidence,
      ...(confident
        ? {
            targetLanguageCode: result.draft.classification.targetLanguageCode?.toLowerCase(),
            targetLanguageName: result.draft.classification.targetLanguageName,
          }
        : {}),
      generationDiagnostics: {
        ...result.diagnostics,
        adkSessionId: result.context.jobId,
        artifactDetails: {
          ...(result.diagnostics.artifactDetails ?? {}),
          languageClassification: result.draft.classification,
          generationRoute: {
            kind: generationModelUsage[0]?.kind,
            workflow: generationModelUsage[0]?.workflow,
            connectionId: generationModelUsage[0]?.connectionId,
            model: generationModelUsage[0]?.model,
            llmSetupId: generationModelUsage[0]?.llmSetupId,
          },
        },
      },
    });
  },

  async markFailed(result: ArtifactAgentFailure) {
    await failPendingFlashcardSet(
      result.context.userId,
      result.context.recordId,
      result.message,
      result.diagnostics
    );
  },

  limits: {
    maxRepairIterations: 2,
    maxCriticIterations: 0,
    timeoutSeconds: 480,
  },
};
