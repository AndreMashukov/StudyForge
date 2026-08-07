import { logger } from 'firebase-functions/v2';
import type {
  GenerationKind,
  IArtifactAgentDiagnostics,
  IGenerationModelUsage,
} from '@shared-types';
import type { GenerationRouteResolution } from '@study-forge/backend-llm/llm/llm-generation-route-resolver';
import { LlmGenerationRouteResolver } from '@study-forge/backend-llm/llm/llm-generation-route-resolver';
import {
  formatGenerationModelLabel,
  toGenerationModelUsage,
} from '@study-forge/backend-llm/llm';
import { createEmptyDiagnostics } from '@study-forge/backend-artifacts/artifact-agent/artifact-agent-definition';
import type { GenerationJob } from '@study-forge/backend-generation/generation-jobs';
import { DocumentCrudService } from '../document-crud';
import { DocumentAgentPipelineFailedError } from '../document-agent/document-agent-errors';
import type { DocumentAgentContext } from '../document-agent/document-agent-runner';
import {
  extractDocumentTitle,
  normalizeGeneratedHtmlFragment,
  validateDocumentHtml,
  wrapHtmlDocument,
} from '../document-html';
import {
  formatValidationFindings,
  type ValidationFinding,
  type ValidationReport,
} from '../document-html/types';
import { getHardSecurityFindings } from './direct-with-repair-security';
import { repairDirectDocumentHtml } from './direct-document-repair-llm';

const DIRECT_WITH_REPAIR_AGENT_DEFINITION_VERSION = 'document-html-direct-with-repair-v1';

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:html|json|markdown)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

function serializeFindings(findings: ValidationFinding[]): Array<Record<string, string>> {
  return findings.map((finding) => ({
    code: finding.code,
    category: finding.category,
    severity: finding.severity,
    message: finding.message,
    ...(finding.pathOrSnippet ? { pathOrSnippet: finding.pathOrSnippet } : {}),
    ...(finding.repairHint ? { repairHint: finding.repairHint } : {}),
  }));
}

export async function persistDirectWithRepairHtmlDocument(params: {
  job: GenerationJob;
  agentContext: DocumentAgentContext;
  resolution: GenerationRouteResolution;
  rawFragment: string;
  generationDurationMs: number;
  generationKind: Extract<GenerationKind, 'documentFromPrompt' | 'documentFromScreenshot'>;
  repairKind: Extract<GenerationKind, 'documentFromPromptRepair' | 'documentFromScreenshotRepair'>;
  description?: string;
  tags?: string[];
  screenshotContext?: string;
}): Promise<void> {
  const htmlFragment = normalizeGeneratedHtmlFragment(stripCodeFences(params.rawFragment));
  const firstValidation = await validateDocumentHtml(htmlFragment);

  let finalFragment = htmlFragment;
  let repairRan = false;
  let repairDurationMs = 0;
  let postRepairValidation: ValidationReport | null = null;
  let repairResolution: GenerationRouteResolution | null = null;

  if (!firstValidation.passed) {
    const validationErrors = formatValidationFindings(firstValidation.findings);
    repairResolution = await LlmGenerationRouteResolver.resolve(params.repairKind, {
      userId: params.job.userId,
    });

    const repairStartMs = Date.now();
    const repairedRaw = await repairDirectDocumentHtml({
      userId: params.job.userId,
      repairKind: params.repairKind,
      userPrompt: params.agentContext.userPrompt,
      rulesText: params.agentContext.rulesText,
      htmlFragment,
      validationErrors,
      screenshotContext: params.screenshotContext,
    });
    repairDurationMs = Date.now() - repairStartMs;
    repairRan = true;

    finalFragment = normalizeGeneratedHtmlFragment(stripCodeFences(repairedRaw));
    postRepairValidation = await validateDocumentHtml(finalFragment);

    const hardSecurityFindings = getHardSecurityFindings(postRepairValidation);
    if (hardSecurityFindings.length > 0) {
      const message = formatValidationFindings(hardSecurityFindings);
      throw new DocumentAgentPipelineFailedError(message);
    }
  }

  const title =
    params.agentContext.titleHint?.trim() ||
    extractDocumentTitle(finalFragment, 'html') ||
    'Generated Document';
  const wrappedHtml = wrapHtmlDocument(finalFragment, title);

  const diagnostics: IArtifactAgentDiagnostics = {
    ...createEmptyDiagnostics({
      artifactKind:
        params.generationKind === 'documentFromScreenshot'
          ? 'documentFromScreenshot'
          : 'documentFromPrompt',
      agentDefinitionVersion: DIRECT_WITH_REPAIR_AGENT_DEFINITION_VERSION,
    }),
    orchestrationMode: 'imperative',
    generatorAttempts: 1,
    repairCount: repairRan ? 1 : 0,
    artifactDetails: {
      generationRoute: {
        kind: params.resolution.kind,
        workflow: params.resolution.workflow,
        connectionId: params.resolution.route.connectionId,
        model: params.resolution.route.model,
        llmSetupId: params.resolution.llmSetupId,
        userGroupId: params.resolution.userGroupId,
      },
      directWithRepair: {
        repairRan,
        firstValidationFindings: serializeFindings(firstValidation.findings),
        postRepairValidationFindings: postRepairValidation
          ? serializeFindings(postRepairValidation.findings)
          : [],
        hardSecurityBlocked: false,
      },
    },
  };

  const generationModelUsage: IGenerationModelUsage[] = [
    {
      ...toGenerationModelUsage(params.resolution, params.generationDurationMs),
      role: 'generation',
    },
  ];

  if (repairRan && repairResolution) {
    generationModelUsage.push({
      ...toGenerationModelUsage(repairResolution, repairDurationMs),
      role: 'agent',
    });
  }

  await DocumentCrudService.completePendingDocument(
    params.agentContext.userId,
    params.agentContext.documentId,
    wrappedHtml,
    {
      title,
      description: params.description ?? params.agentContext.description,
      tags: params.tags ?? params.agentContext.tags,
      appliedRuleIds: params.agentContext.appliedRuleIds,
      generationModel: formatGenerationModelLabel(params.resolution.route),
      generationModelUsage,
      generationDiagnostics: diagnostics,
      contentFormat: 'html',
    }
  );

  logger.info('Direct-with-repair HTML document generation completed', {
    userId: params.agentContext.userId,
    documentId: params.agentContext.documentId,
    jobId: params.job.id,
    workflow: params.resolution.workflow,
    generationKind: params.generationKind,
    repairRan,
    postRepairFindingCount: postRepairValidation?.findings.length ?? 0,
  });
}
