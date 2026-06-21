import { RuleApplicability } from '@shared-types';
import { FirestoreService } from '../firestore';
import { DocumentCrudService } from '../document-crud';
import { GeminiService } from '../gemini';
import { LlmGenerationService, resolveTextGenerationModelLabel } from '../llm';
import { isRuleResolutionMode, resolveEffectiveRules } from '../rule-resolution';
import {
  completePendingDiagramQuiz,
  failPendingDiagramQuiz,
} from '../artifact-generation-records';
import type {
  ArtifactAgentDefinition,
  ArtifactAgentJobInput,
  ArtifactAgentResult,
  ArtifactAgentFailure,
} from '../artifact-agent/artifact-agent-definition';
import { recordModelUsage } from '../artifact-agent/artifact-agent-definition';
import { diagramQuizGates } from './diagram-quiz-gates';
import {
  diagramQuizCriticStrategy,
  diagramQuizRefinerStrategy,
  diagramQuizRepairStrategy,
} from './diagram-quiz-agent-helpers';
import type { IDiagramQuizDraft, IDiagramQuizJobPayload } from './diagram-quiz-types';

const AGENT_DEFINITION_VERSION = 'diagram-quiz-v1';

async function loadDiagramQuizContext(
  input: ArtifactAgentJobInput<IDiagramQuizJobPayload>
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

  GeminiService.validateContentForQuiz(documentContent);

  let enhancedPrompt = payload.additionalPrompt || '';
  const hasLegacyExplicitRules = Boolean(
    payload.ruleIds?.length || payload.followupRuleIds?.length
  );
  const mode = isRuleResolutionMode(payload.ruleResolutionMode)
    ? payload.ruleResolutionMode
    : hasLegacyExplicitRules
      ? 'explicit-only'
      : 'inherit-plus-explicit';

  const selectedQuizRuleIds = payload.ruleIds?.length
    ? payload.ruleIds
    : payload.additionalRuleIds;

  const { text: quizRulesText, ruleIds: appliedRuleIds } = await resolveEffectiveRules({
    userId: input.userId,
    directoryId: input.directoryId,
    operation: RuleApplicability.DIAGRAM_QUIZ,
    additionalRuleIds: selectedQuizRuleIds,
    mode,
  });

  if (quizRulesText) {
    enhancedPrompt = `${quizRulesText}\n\n${enhancedPrompt}`;
  }

  const { ruleIds: followupRuleIds } = await resolveEffectiveRules({
    userId: input.userId,
    directoryId: input.directoryId,
    operation: RuleApplicability.FOLLOWUP,
    additionalRuleIds: hasLegacyExplicitRules
      ? payload.followupRuleIds
      : payload.additionalRuleIds,
    mode,
  });

  const pendingTitle =
    payload.title?.trim() ||
    payload.artifactPayload?.diagramQuizName?.trim() ||
    (documentIds.length === 1
      ? `Diagram Quiz from ${documentDataList[0].doc.title}`
      : `Diagram Quiz from ${documentDataList[0].doc.title} + ${documentIds.length - 1} more`);

  return {
    userId: input.userId,
    directoryId: input.directoryId,
    recordId: input.recordId,
    jobId: input.jobId,
    artifactKind: 'diagramQuiz',
    documentIds,
    title: pendingTitle,
    enhancedPrompt,
    appliedRuleIds,
    followupRuleIds,
    sourceContent: documentContent,
  };
}

export const diagramQuizDefinition: ArtifactAgentDefinition<
  IDiagramQuizDraft,
  IDiagramQuizJobPayload
> = {
  artifactKind: 'diagramQuiz',
  displayName: 'Diagram Quiz',
  collection: 'diagramQuizzes',
  primaryCapability: 'diagramQuiz',
  helperCapability: 'diagramQuizAgent',
  agentDefinitionVersion: AGENT_DEFINITION_VERSION,
  warningsBlockCompletion: false,

  loadContext: loadDiagramQuizContext,

  async generate(context, diagnostics) {
    const startedAt = Date.now();
    const draft = await LlmGenerationService.generateDiagramQuizChunked(
      context.sourceContent,
      context.enhancedPrompt
    );
    const generationModel = await resolveTextGenerationModelLabel('diagramQuiz');
    recordModelUsage(diagnostics, {
      role: 'generator',
      capability: 'diagramQuiz',
      model: generationModel,
      durationMs: Date.now() - startedAt,
    });
    return draft as IDiagramQuizDraft;
  },

  gates: diagramQuizGates,
  repair: diagramQuizRepairStrategy,
  critic: diagramQuizCriticStrategy,
  refiner: diagramQuizRefinerStrategy,

  async persistCompleted(result: ArtifactAgentResult<IDiagramQuizDraft>) {
    const generationModel =
      result.generationModel || (await resolveTextGenerationModelLabel('diagramQuiz'));
    const agentModel =
      result.agentModel || (await resolveTextGenerationModelLabel('diagramQuizAgent'));

    await completePendingDiagramQuiz(result.context.userId, result.context.recordId, {
      title: result.context.title,
      questions: result.draft.questions,
      appliedRuleIds: result.context.appliedRuleIds,
      followupRuleIds: result.context.followupRuleIds,
      generationModel,
      agentModel,
      generationDiagnostics: {
        ...result.diagnostics,
        adkSessionId: result.context.jobId,
      },
    });
  },

  async markFailed(result: ArtifactAgentFailure) {
    await failPendingDiagramQuiz(
      result.context.userId,
      result.context.recordId,
      result.message,
      result.diagnostics
    );
  },

  limits: {
    maxRepairIterations: 4,
    maxCriticIterations: 2,
    timeoutSeconds: 480,
  },
};
