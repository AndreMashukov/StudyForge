#!/usr/bin/env npx tsx
/**
 * Application experiment: live agentMessageStream for platform-knowledge cases.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.base.json scripts/langsmith-eval/experiments/run-platform-knowledge-application.ts
 *
 * Emulator only.
 */
import '../shared/emulator-env';
import { Client } from 'langsmith';
import { evaluate } from 'langsmith/evaluation';
import {
  policyFactsLangsmithEvaluators,
  selfCheckPlatformKnowledgeEvaluators,
} from '../evaluators/platform-knowledge';
import { PLATFORM_KNOWLEDGE_DATASET_NAME } from '../shared/constants';
import { loadEvalEnv, requireEnv } from '../shared/env';
import {
  mintLiveEvalIdToken,
  resolveAgentMessageStreamUrl,
  resolveFirebaseProjectId,
  resolveLiveEvalTarget,
  streamWorkspaceAgentFinalReply,
} from '../shared/live-agent-client';
import { loadDatasetEvalData, readMaxExamples } from '../shared/load-examples';
import { readPlatformKnowledgePin } from '../targets/search-platform-knowledge';

loadEvalEnv();

async function main(): Promise<void> {
  requireEnv('LANGSMITH_API_KEY');
  requireEnv('LANGSMITH_PROJECT');
  selfCheckPlatformKnowledgeEvaluators();

  const target = resolveLiveEvalTarget();
  if (target === 'production') {
    throw new Error(
      'Platform-knowledge application eval is emulator-only. Do not set LIVE_EVAL_TARGET=production.',
    );
  }

  const pin = await readPlatformKnowledgePin();
  console.log(
    `Pinned ${pin.documentId} hash=${pin.publishedContentHash}`,
  );

  const projectId = resolveFirebaseProjectId();
  const streamUrl = resolveAgentMessageStreamUrl(projectId, target);
  const idToken = await mintLiveEvalIdToken({ target });
  console.log(`Streaming ${streamUrl}`);

  const client = new Client({ apiKey: process.env.LANGSMITH_API_KEY });
  const data = await loadDatasetEvalData(
    client,
    PLATFORM_KNOWLEDGE_DATASET_NAME,
    readMaxExamples(),
  );

  async function liveWorkspaceAgent(inputs: {
    objective?: string;
  }): Promise<{ finalReply: string }> {
    const objective =
      typeof inputs.objective === 'string' ? inputs.objective : '';
    if (!objective.trim()) {
      throw new Error('Example is missing inputs.objective');
    }
    const finalReply = await streamWorkspaceAgentFinalReply({
      streamUrl,
      idToken,
      objective,
    });
    await new Promise((resolve) => setTimeout(resolve, 3500));
    return { finalReply };
  }

  const results = await evaluate(liveWorkspaceAgent, {
    data,
    client,
    evaluators: policyFactsLangsmithEvaluators(),
    experimentPrefix: 'workspace-agent-pk-application-v1',
    maxConcurrency: 1,
    metadata: {
      evalKind: 'platform-knowledge-application',
      dataset: PLATFORM_KNOWLEDGE_DATASET_NAME,
      liveEvalTarget: target,
      streamUrl,
      platformKnowledgeDocumentId: pin.documentId,
      publishedContentHash: pin.publishedContentHash,
    },
  });

  const experimentName =
    'experimentName' in results
      ? String(results.experimentName)
      : 'workspace-agent-pk-application-v1';
  console.log(`Experiment: ${experimentName}`);
  console.log(`Dataset: ${PLATFORM_KNOWLEDGE_DATASET_NAME}`);
  console.log('Metric: policy_facts');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
