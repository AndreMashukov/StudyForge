import { logger } from 'firebase-functions/v2';
import type { GenerationKind, IArtifactAgentDiagnostics, IGenerationModelUsage } from '@shared-types';
import type { GenerationRouteResolution } from '@study-forge/backend-llm/llm/llm-generation-route-resolver';
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
import { formatValidationFindings } from '../document-html/types';

const DIRECT_AGENT_DEFINITION_VERSION = 'document-html-direct-v1';

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:html|json|markdown)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

export async function persistDirectHtmlDocument(params: {
  job: GenerationJob;
  agentContext: DocumentAgentContext;
  resolution: GenerationRouteResolution;
  rawFragment: string;
  durationMs: number;
  generationKind: GenerationKind;
  description?: string;
  tags?: string[];
}): Promise<void> {
  const htmlFragment = normalizeGeneratedHtmlFragment(stripCodeFences(params.rawFragment));
  const validationReport = await validateDocumentHtml(htmlFragment);

  if (!validationReport.passed) {
    const message = formatValidationFindings(validationReport.findings);
    throw new DocumentAgentPipelineFailedError(message);
  }

  const title =
    params.agentContext.titleHint?.trim() ||
    extractDocumentTitle(htmlFragment, 'html') ||
    'Generated Document';
  const wrappedHtml = wrapHtmlDocument(htmlFragment, title);

  const diagnostics: IArtifactAgentDiagnostics = {
    ...createEmptyDiagnostics({
      artifactKind: params.generationKind === 'documentFromScreenshot' ? 'documentFromScreenshot' : 'documentFromPrompt',
      agentDefinitionVersion: DIRECT_AGENT_DEFINITION_VERSION,
    }),
    orchestrationMode: 'imperative',
    generatorAttempts: 1,
    artifactDetails: {
      generationRoute: {
        kind: params.resolution.kind,
        workflow: params.resolution.workflow,
        connectionId: params.resolution.route.connectionId,
        model: params.resolution.route.model,
        llmSetupId: params.resolution.llmSetupId,
        userGroupId: params.resolution.userGroupId,
      },
    },
  };

  const generationModelUsage: IGenerationModelUsage[] = [
    {
      ...toGenerationModelUsage(params.resolution, params.durationMs),
      role: 'generation',
    },
  ];

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

  logger.info('Direct HTML document generation completed', {
    userId: params.agentContext.userId,
    documentId: params.agentContext.documentId,
    jobId: params.job.id,
    workflow: params.resolution.workflow,
    generationKind: params.generationKind,
  });
}
