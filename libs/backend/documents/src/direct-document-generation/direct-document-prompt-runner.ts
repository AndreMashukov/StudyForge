import { logger } from 'firebase-functions/v2';
import type { IDocumentAgentJobPayload } from '@shared-types';
import type { IFileContent } from '@shared-types';
import { LlmGenerationRouteResolver } from '@study-forge/backend-llm/llm/llm-generation-route-resolver';
import { LlmGenerationService } from '@study-forge/backend-llm/llm';
import { validateContextFiles } from '@study-forge/backend-llm/gemini/prompt-builder/withContextFiles';
import type { GenerationJob } from '@study-forge/backend-generation/generation-jobs';
import { prepareDocumentAgentContext } from '../document-agent/document-agent-runner';
import { buildDirectHtmlPrompt } from './direct-document-prompt-builder';
import { persistDirectHtmlDocument } from './direct-document-persistence';

export async function runDirectDocumentFromPrompt(
  job: GenerationJob,
  payload: IDocumentAgentJobPayload
): Promise<void> {
  const agentContext = await prepareDocumentAgentContext(job, payload);
  const resolution = await LlmGenerationRouteResolver.resolve('documentFromPrompt', {
    userId: job.userId,
  });

  const files: IFileContent[] | undefined = agentContext.files;
  if (files?.length) {
    validateContextFiles(files);
  }

  const prompt = buildDirectHtmlPrompt(agentContext);

  logger.info('Starting direct prompt document generation (single-pass HTML)', {
    userId: job.userId,
    jobId: job.id,
    documentId: job.recordId,
    workflow: resolution.workflow,
    promptLength: prompt.length,
  });

  const startMs = Date.now();
  const rawFragment = await LlmGenerationService.generateText(
    job.userId,
    'documentFromPrompt',
    prompt,
    {
      logLabel: 'direct-document-from-prompt',
      successLogMessage: 'Direct HTML document fragment generated',
      temperature: 0.4,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 16384,
    }
  );

  await persistDirectHtmlDocument({
    job,
    agentContext,
    resolution,
    rawFragment,
    durationMs: Date.now() - startMs,
    generationKind: 'documentFromPrompt',
    description: agentContext.description ?? 'Generated from prompt',
    tags: agentContext.tags ?? ['ai-generated', 'prompt-based', 'direct'],
  });
}
