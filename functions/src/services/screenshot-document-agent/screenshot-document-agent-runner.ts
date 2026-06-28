import { logger } from 'firebase-functions/v2';
import type { IDocumentFromScreenshotJobPayload, IArtifactAgentDiagnostics, IGenerationModelUsage } from '@shared-types';
import { RuleApplicability } from '@shared-types';
import { DocumentCrudService } from '../document-crud';
import {
  LlmGenerationRouteResolver,
  LlmGenerationService,
  formatGenerationModelLabel,
  toGenerationModelUsage,
} from '../llm';
import { isRuleResolutionMode, resolveEffectiveRules } from '../rule-resolution';
import { createEmptyDiagnostics, recordModelUsage } from '../artifact-agent/artifact-agent-definition';
import type { GenerationJob } from '../generation-jobs';

const AGENT_DEFINITION_VERSION = 'screenshot-document-v1';

export async function runScreenshotDocumentAgentPipeline(
  job: GenerationJob,
  data: IDocumentFromScreenshotJobPayload
): Promise<void> {
  const routeResolution = await LlmGenerationRouteResolver.resolve('documentFromScreenshot', {
    userId: job.userId,
  });

  if (routeResolution.workflow !== 'agentic') {
    throw new Error('Screenshot agent pipeline requires agentic workflow route');
  }

  const diagnostics: IArtifactAgentDiagnostics = {
    ...createEmptyDiagnostics({
      artifactKind: 'documentFromScreenshot',
      agentDefinitionVersion: AGENT_DEFINITION_VERSION,
    }),
    artifactDetails: {
      generationRoute: {
        kind: routeResolution.kind,
        workflow: routeResolution.workflow,
        connectionId: routeResolution.route.connectionId,
        model: routeResolution.route.model,
        llmSetupId: routeResolution.llmSetupId,
        userGroupId: routeResolution.userGroupId,
      },
    },
  };

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

  const extractStartMs = Date.now();
  let draft = await LlmGenerationService.generateDocumentFromScreenshot(
    job.userId,
    data.imageBase64,
    data.prompt,
    rulesText || undefined
  );
  diagnostics.generatorAttempts += 1;
  recordModelUsage(diagnostics, {
    role: 'generator',
    capability: 'documentFromScreenshot',
    model: routeResolution.route.model,
    durationMs: Date.now() - extractStartMs,
  });

  if (!draft.trim()) {
    diagnostics.residuals.push({
      gateId: 'nonEmptyDraft',
      severity: 'blocker',
      message: 'Screenshot extraction produced empty content',
    });
  }

  if (rulesText?.trim()) {
    const complianceStartMs = Date.now();
    const compliance = await LlmGenerationService.evaluateScreenshotRuleCompliance(
      job.userId,
      draft,
      data.prompt,
      rulesText
    );
    recordModelUsage(diagnostics, {
      role: 'critic',
      capability: 'ruleGeneration',
      durationMs: Date.now() - complianceStartMs,
    });
    diagnostics.criticCycles += 1;

    if (!compliance.passed) {
      diagnostics.residuals.push({
        gateId: 'ruleCompliance',
        severity: 'warning',
        message: compliance.summary || 'Rule compliance review reported issues',
      });

      if (compliance.revisedContent?.trim()) {
        const refineStartMs = Date.now();
        draft = compliance.revisedContent;
        recordModelUsage(diagnostics, {
          role: 'refiner',
          capability: 'ruleGeneration',
          durationMs: Date.now() - refineStartMs,
        });
      }
    }
  }

  const title = resolveScreenshotTitle({
    generatedContent: draft,
    title: data.title,
    prompt: data.prompt,
  });

  const generationModelUsage: IGenerationModelUsage[] = [
    toGenerationModelUsage(routeResolution, diagnostics.modelUsage[0]?.durationMs),
  ];

  for (const entry of diagnostics.modelUsage.slice(1)) {
    generationModelUsage.push({
      kind: 'documentFromScreenshot',
      role: 'agent',
      workflow: routeResolution.workflow,
      modality: routeResolution.modality,
      providerKind: routeResolution.route.providerType,
      connectionId: routeResolution.route.connectionId,
      model: entry.model || routeResolution.route.model,
      llmSetupId: routeResolution.llmSetupId,
      userGroupId: routeResolution.userGroupId,
      durationMs: entry.durationMs,
    });
  }

  await DocumentCrudService.completePendingDocument(job.userId, job.recordId, draft, {
    title,
    description: 'Captured from screenshot',
    tags: ['screenshot', 'captured', 'agentic'],
    appliedRuleIds: effectiveRuleIds,
    generationModel: formatGenerationModelLabel(routeResolution.route),
    generationModelUsage,
    generationDiagnostics: diagnostics,
  });

  logger.info('Screenshot agentic document generation completed', {
    userId: job.userId,
    documentId: job.recordId,
    residualCount: diagnostics.residuals.length,
  });
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
