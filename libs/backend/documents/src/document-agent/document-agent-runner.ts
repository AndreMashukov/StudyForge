import { logger } from 'firebase-functions/v2';
import { InMemoryRunner } from '@google/adk';
import type {
  IDocumentAgentJobPayload,
  IArtifactAgentDiagnostics,
} from '@shared-types';
import type { GenerationJob } from '@study-forge/backend-generation/generation-jobs';
import { createEmptyDiagnostics } from '@study-forge/backend-artifacts/artifact-agent/artifact-agent-definition';
import { resolveEffectiveRules } from '@study-forge/backend-directories/rule-resolution';
import { RuleApplicability } from '@shared-types';
import { resolveDocumentAgentRuleMode } from './document-agent-rule-mode';
import {
  createDocumentPipeline,
  readPipelineFailureMessage,
  readPipelineOutcome,
} from './document-agent-pipeline-factory';
import { DocumentAgentPipelineFailedError } from './document-agent-errors';
import type { DocumentRule } from '../document-html/types';
import type { IFileContent } from '@shared-types';

const AGENT_DEFINITION_VERSION = 'document-html-v1';
const DOCUMENT_AGENT_APP_NAME = 'study-forge-document-agent';

export interface DocumentAgentContext {
  userId: string;
  directoryId: string;
  documentId: string;
  jobId: string;
  payload: IDocumentAgentJobPayload;
  userPrompt: string;
  files?: IFileContent[];
  rulesText: string;
  rules: DocumentRule[];
  appliedRuleIds: string[];
  titleHint?: string;
  description?: string;
  tags?: string[];
}

function resolveRuleApplicability(
  sourceKind: IDocumentAgentJobPayload['sourceKind'],
): RuleApplicability {
  if (sourceKind === 'upload') {
    return RuleApplicability.UPLOAD;
  }
  return RuleApplicability.PROMPT;
}

function buildUserPrompt(payload: IDocumentAgentJobPayload): string {
  switch (payload.sourceKind) {
    case 'prompt':
      return (
        payload.prompt?.trim() || 'Generate a comprehensive learning document.'
      );
    case 'upload':
      return `Transform the uploaded source material into a comprehensive StudyForge learning document.

Source filename: ${payload.sourceFilename || 'upload'}
Source material:
${payload.sourceText || ''}`;
    case 'url':
      return `Create a comprehensive educational document from the attached URL source material.

Source URLs:
${(payload.sourceUrls || (payload.sourceUrl ? [payload.sourceUrl] : [])).map((url, index) => `${index + 1}. ${url}`).join('\n')}

Extracted source material:
${payload.sourceText || ''}`;
    case 'screenshot':
      return payload.prompt?.trim()
        ? `Process the screenshot content. Additional instructions: ${payload.prompt.trim()}`
        : 'Process the screenshot content according to the Domain Rules when present; otherwise extract the visible content as an HTML fragment.';
    case 'content':
      return `Transform the following source content into a comprehensive StudyForge learning document:

${payload.sourceText || payload.prompt || ''}`;
    default:
      return (
        payload.prompt?.trim() || 'Generate a comprehensive learning document.'
      );
  }
}

function parseRulesFromText(rulesText: string): DocumentRule[] {
  if (!rulesText.trim()) {
    return [];
  }
  return [{ name: 'Applied Rules', content: rulesText.trim() }];
}

export function buildDocumentAgentContext(
  job: GenerationJob,
  payload: IDocumentAgentJobPayload,
  rulesText: string,
  appliedRuleIds: string[],
): DocumentAgentContext {
  return {
    userId: job.userId,
    directoryId: job.directoryId,
    documentId: job.recordId,
    jobId: job.id,
    payload,
    userPrompt: buildUserPrompt(payload),
    files: payload.files,
    rulesText,
    rules: parseRulesFromText(rulesText),
    appliedRuleIds,
    titleHint: payload.title,
    description: payload.description,
    tags: payload.tags,
  };
}

export async function prepareDocumentAgentContext(
  job: GenerationJob,
  payload: IDocumentAgentJobPayload,
): Promise<DocumentAgentContext> {
  const mode = resolveDocumentAgentRuleMode(payload);

  const { text: rulesText, ruleIds: effectiveRuleIds } =
    await resolveEffectiveRules({
      userId: job.userId,
      directoryId: job.directoryId,
      operation: resolveRuleApplicability(payload.sourceKind),
      additionalRuleIds: payload.ruleIds?.length
        ? payload.ruleIds
        : payload.additionalRuleIds,
      mode,
    });

  return buildDocumentAgentContext(job, payload, rulesText, effectiveRuleIds);
}

export async function runDocumentAgentPipeline(
  job: GenerationJob,
  payload: IDocumentAgentJobPayload,
): Promise<void> {
  const agentContext = await prepareDocumentAgentContext(job, payload);
  const diagnostics: IArtifactAgentDiagnostics = {
    ...createEmptyDiagnostics({
      artifactKind: 'documentFromPrompt',
      agentDefinitionVersion: AGENT_DEFINITION_VERSION,
    }),
    orchestrationMode: 'adk-runner',
  };

  logger.info('Starting document HTML agent pipeline', {
    userId: job.userId,
    documentId: job.recordId,
    jobId: job.id,
    sourceKind: payload.sourceKind,
    orchestrationMode: 'adk-runner',
  });

  const pipeline = createDocumentPipeline();
  const runner = new InMemoryRunner({
    agent: pipeline,
    appName: DOCUMENT_AGENT_APP_NAME,
  });

  await runner.sessionService.createSession({
    appName: DOCUMENT_AGENT_APP_NAME,
    userId: job.userId,
    sessionId: job.id,
    state: {
      agentContext,
      diagnostics,
      htmlFragment: '',
      validationReport: null,
      plan: null,
      repairCount: 0,
      criticFindings: '',
      wrappedHtml: '',
      generationModel: '',
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _event of runner.runAsync({
    userId: job.userId,
    sessionId: job.id,
    newMessage: { parts: [{ text: 'Run document generation job' }] },
  })) {
    // Pipeline side effects are persisted by FinalizeAgent.
  }

  const finalSession = await runner.sessionService.getSession({
    appName: DOCUMENT_AGENT_APP_NAME,
    userId: job.userId,
    sessionId: job.id,
  });

  if (!finalSession) {
    throw new Error(
      `Document agent session ${job.id} not found after pipeline run`,
    );
  }

  const outcome = readPipelineOutcome(finalSession.state);
  if (outcome === 'failed') {
    throw new DocumentAgentPipelineFailedError(
      readPipelineFailureMessage(finalSession.state),
    );
  }

  if (outcome !== 'completed') {
    throw new Error(
      `Document agent pipeline finished without a terminal outcome (jobId=${job.id})`,
    );
  }
}
