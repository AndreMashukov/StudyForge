import type { IDocumentAgentJobPayload } from '@shared-types';
import { LlmGenerationRouteResolver } from '@study-forge/backend-llm/llm/llm-generation-route-resolver';
import type { GenerationJob } from '@study-forge/backend-generation/generation-jobs';
import { runDocumentAgentPipeline } from '../document-agent/document-agent-runner';
import { runDirectDocumentFromPrompt } from './direct-document-prompt-runner';
import { runDirectDocumentFromScreenshot } from './direct-document-screenshot-runner';

export async function runPromptDocumentGeneration(
  job: GenerationJob,
  payload: IDocumentAgentJobPayload
): Promise<void> {
  const resolution = await LlmGenerationRouteResolver.resolve('documentFromPrompt', {
    userId: job.userId,
  });

  if (resolution.workflow === 'direct') {
    await runDirectDocumentFromPrompt(job, payload);
    return;
  }

  await runDocumentAgentPipeline(job, payload);
}

export async function runScreenshotDocumentGeneration(
  job: GenerationJob,
  payload: IDocumentAgentJobPayload
): Promise<void> {
  const resolution = await LlmGenerationRouteResolver.resolve('documentFromScreenshot', {
    userId: job.userId,
  });

  if (resolution.workflow === 'direct') {
    await runDirectDocumentFromScreenshot(job, payload);
    return;
  }

  await runDocumentAgentPipeline(job, payload);
}
