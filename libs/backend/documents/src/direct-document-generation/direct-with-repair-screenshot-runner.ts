import { logger } from 'firebase-functions/v2';
import type { IDocumentAgentJobPayload } from '@shared-types';
import { buildHtmlScreenshotDocumentPrompt } from '@shared-types';
import { LlmGenerationRouteResolver } from '@study-forge/backend-llm/llm/llm-generation-route-resolver';
import { LlmGenerationService } from '@study-forge/backend-llm/llm';
import type { GenerationJob } from '@study-forge/backend-generation/generation-jobs';
import { prepareDocumentAgentContext } from '../document-agent/document-agent-runner';
import { persistDirectWithRepairHtmlDocument } from './direct-with-repair-persistence';

export async function runDirectWithRepairDocumentFromScreenshot(
  job: GenerationJob,
  payload: IDocumentAgentJobPayload
): Promise<void> {
  if (payload.sourceKind !== 'screenshot' || !payload.imageBase64?.trim()) {
    throw new Error(`Screenshot direct-with-repair runner requires image payload (jobId=${job.id})`);
  }

  const agentContext = await prepareDocumentAgentContext(job, payload);
  const resolution = await LlmGenerationRouteResolver.resolve('documentFromScreenshot', {
    userId: job.userId,
  });

  const prompt = buildHtmlScreenshotDocumentPrompt({
    userPrompt: payload.prompt,
    rules: agentContext.rulesText || undefined,
  });

  logger.info('Starting direct-with-repair screenshot document generation', {
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

  const screenshotContext = [
    payload.prompt?.trim() ? `User prompt: ${payload.prompt.trim()}` : null,
    payload.title?.trim() ? `Title hint: ${payload.title.trim()}` : null,
    agentContext.rulesText?.trim() ? `Applied rules summary present (${agentContext.appliedRuleIds.length} rules)` : null,
  ]
    .filter(Boolean)
    .join('\n');

  await persistDirectWithRepairHtmlDocument({
    job,
    agentContext,
    resolution,
    rawFragment,
    generationDurationMs: Date.now() - startMs,
    generationKind: 'documentFromScreenshot',
    description: 'Captured from screenshot',
    tags: ['screenshot', 'captured', 'direct-with-repair'],
    screenshotContext: screenshotContext || undefined,
  });
}
