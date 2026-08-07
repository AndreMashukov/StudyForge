import type { IDocumentAgentJobPayload, IDocumentFromScreenshotJobPayload } from '@shared-types';
import { LlmGenerationRouteResolver } from '@study-forge/backend-llm/llm/llm-generation-route-resolver';
import type { GenerationJob } from '@study-forge/backend-generation/generation-jobs';
import { runDocumentAgentPipeline } from '../document-agent/document-agent-runner';
import { runScreenshotDocumentAgentPipeline } from '../screenshot-document-agent/screenshot-document-agent-runner';
import { runDirectDocumentFromPrompt } from './direct-document-prompt-runner';
import { runDirectDocumentFromScreenshot } from './direct-document-screenshot-runner';
import { runDirectWithRepairDocumentFromPrompt } from './direct-with-repair-prompt-runner';
import { runDirectWithRepairDocumentFromScreenshot } from './direct-with-repair-screenshot-runner';

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

  if (resolution.workflow === 'directWithRepair') {
    await runDirectWithRepairDocumentFromPrompt(job, payload);
    return;
  }

  await runDocumentAgentPipeline(job, payload);
}

function toScreenshotJobPayload(
  job: GenerationJob,
  payload: IDocumentAgentJobPayload
): IDocumentFromScreenshotJobPayload {
  if (payload.sourceKind !== 'screenshot' || !payload.imageBase64?.trim()) {
    throw new Error('Screenshot generation requires sourceKind=screenshot and imageBase64');
  }

  return {
    imageBase64: payload.imageBase64,
    directoryId: job.directoryId,
    prompt: payload.prompt,
    title: payload.title,
    ruleIds: payload.ruleIds,
    additionalRuleIds: payload.additionalRuleIds,
    ruleResolutionMode: payload.ruleResolutionMode,
  };
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

  if (resolution.workflow === 'directWithRepair') {
    await runDirectWithRepairDocumentFromScreenshot(job, payload);
    return;
  }

  // Agentic (and any non-direct) screenshot routes must use the vision pipeline.
  // Never fall through to the text-only document-html ADK agent: it ignores the
  // image and reframes the task as a generic comprehensive learning document.
  await runScreenshotDocumentAgentPipeline(job, toScreenshotJobPayload(job, payload));
}
