import { logger } from 'firebase-functions/v2';
import type { IDocumentAgentJobPayload } from '@shared-types';
import { buildHtmlScreenshotDocumentPrompt } from '@shared-types';
import { LlmGenerationRouteResolver } from '@study-forge/backend-llm/llm/llm-generation-route-resolver';
import { LlmGenerationService } from '@study-forge/backend-llm/llm';
import type { GenerationJob } from '@study-forge/backend-generation/generation-jobs';
import { prepareDocumentAgentContext } from '../document-agent/document-agent-runner';
import { persistDirectHtmlDocument } from './direct-document-persistence';

export async function runDirectDocumentFromScreenshot(
  job: GenerationJob,
  payload: IDocumentAgentJobPayload
): Promise<void> {
  if (payload.sourceKind !== 'screenshot' || !payload.imageBase64?.trim()) {
    throw new Error(`Screenshot direct runner requires image payload (jobId=${job.id})`);
  }

  const agentContext = await prepareDocumentAgentContext(job, payload);
  const resolution = await LlmGenerationRouteResolver.resolve('documentFromScreenshot', {
    userId: job.userId,
  });

  if (resolution.workflow !== 'direct') {
    throw new Error(
      `Direct screenshot runner requires direct workflow (jobId=${job.id}, workflow=${resolution.workflow})`
    );
  }

  const prompt = buildHtmlScreenshotDocumentPrompt({
    userPrompt: payload.prompt,
    rules: agentContext.rulesText || undefined,
  });

  logger.info('Starting direct screenshot document generation (single-pass HTML)', {
    userId: job.userId,
    jobId: job.id,
    documentId: job.recordId,
    workflow: resolution.workflow,
  });

  const startMs = Date.now();
  const rawFragment = await LlmGenerationService.generateVisionHtmlFragment(
    job.userId,
    'documentFromScreenshot',
    payload.imageBase64,
    prompt
  );

  await persistDirectHtmlDocument({
    job,
    agentContext,
    resolution,
    rawFragment,
    durationMs: Date.now() - startMs,
    generationKind: 'documentFromScreenshot',
    description: 'Captured from screenshot',
    tags: ['screenshot', 'captured', 'direct'],
  });
}
