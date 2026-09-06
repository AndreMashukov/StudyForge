import { RuleApplicability } from '@shared-types';
import { FirestoreService } from '../firestore';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import { validateContentForArtifactGeneration } from '@study-forge/backend-llm/llm';
import {
  LlmGenerationService,
  LlmGenerationRouteResolver,
  formatGenerationModelLabel,
  resolveTextGenerationAudit,
} from '@study-forge/backend-llm/llm';
import { isRuleResolutionMode, resolveEffectiveRules } from '@study-forge/backend-directories/rule-resolution';
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

  validateContentForArtifactGeneration(documentContent);

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

/**
 * Persist a successful diagram-quiz run to Firestore.
 *
 * P3: invoked from the LangGraph `finalize.node.ts` when
 * `artifact_outcome === 'succeeded'`. The LangGraph finalize node is
 * responsible for assembling the `ArtifactAgentResult` payload from
 * pipeline state and forwarding it here. The canonical completion path is
 * `completePendingDiagramQuiz`, which writes the diagram-quiz document and
 * marks the artifact-generation record complete.
 */
export async function persistCompletedDiagramQuiz(
  result: ArtifactAgentResult<IDiagramQuizDraft>
): Promise<void> {
  const diagramAudit = await resolveTextGenerationAudit(result.context.userId, 'diagramQuiz');
  const generationModel = result.generationModel || diagramAudit.generationModel;
  const agentModel = result.agentModel || diagramAudit.generationModel;

  await completePendingDiagramQuiz(result.context.userId, result.context.recordId, {
    title: result.context.title,
    questions: result.draft.questions,
    appliedRuleIds: result.context.appliedRuleIds,
    followupRuleIds: result.context.followupRuleIds,
    generationModel,
    agentModel,
    generationModelUsage: diagramAudit.generationModelUsage,
    generationDiagnostics: {
      ...result.diagnostics,
      adkSessionId: result.context.jobId,
      artifactDetails: {
        ...(result.diagnostics.artifactDetails ?? {}),
        generationRoute: {
          kind: diagramAudit.generationModelUsage[0]?.kind,
          workflow: diagramAudit.generationModelUsage[0]?.workflow,
          connectionId: diagramAudit.generationModelUsage[0]?.connectionId,
          model: diagramAudit.generationModelUsage[0]?.model,
          llmSetupId: diagramAudit.generationModelUsage[0]?.llmSetupId,
        },
      },
    },
  });
}

/**
 * Persist a failed diagram-quiz run to Firestore.
 *
 * P3: invoked from the LangGraph `finalize.node.ts` when
 * `artifact_outcome === 'failed'`. The LangGraph finalize node forwards
 * the failure message and diagnostics collected across the pipeline. The
 * canonical failure path is `failPendingDiagramQuiz`, which marks the
 * artifact-generation record failed and surfaces the reason to the user.
 */
export async function markFailedDiagramQuiz(
  result: ArtifactAgentFailure
): Promise<void> {
  await failPendingDiagramQuiz(
    result.context.userId,
    result.context.recordId,
    result.message,
    result.diagnostics
  );
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
      context.userId,
      context.sourceContent,
      context.enhancedPrompt
    );
    const routeResolution = await LlmGenerationRouteResolver.resolve('diagramQuiz', {
      userId: context.userId,
    });
    const generationModel = formatGenerationModelLabel(routeResolution.route);
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

  // P3: the LangGraph `finalize.node.ts` calls these hooks based on
  // `artifact_outcome`. The success path forwards the assembled
  // `ArtifactAgentResult`; the failure path forwards an
  // `ArtifactAgentFailure` with the message and diagnostics captured by
  // the pipeline. Both delegate to the helpers exported from this module
  // so the legacy ADK pipeline and the LangGraph pipeline share the same
  // Firestore write surface.
  persistCompleted: persistCompletedDiagramQuiz,
  markFailed: markFailedDiagramQuiz,

  limits: {
    maxRepairIterations: 4,
    maxCriticIterations: 2,
    timeoutSeconds: 480,
  },
};