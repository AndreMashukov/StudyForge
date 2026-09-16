#!/usr/bin/env npx tsx
/**
 * Live workspace-agent experiment: emulator (or production) agentMessageStream.
 *
 * Usage:
 *   npx tsx scripts/langsmith-eval/experiments/run-final-response-live.ts
 */
import { Client } from 'langsmith';
import { evaluate } from 'langsmith/evaluation';
import {
  localFinalResponseEvaluators,
  selfCheckFinalResponseEvaluators,
} from '../evaluators/local-criteria-match';
import { FINAL_RESPONSE_DATASET_NAME } from '../shared/constants';
import { loadEvalEnv, requireEnv } from '../shared/env';
import {
  mintLiveEvalIdToken,
  resolveAgentMessageStreamUrl,
  resolveFirebaseProjectId,
  resolveLiveEvalTarget,
  streamWorkspaceAgentFinalReply,
} from '../shared/live-agent-client';
import { loadDatasetEvalData, readMaxExamples } from '../shared/load-examples';

loadEvalEnv();

async function main(): Promise<void> {
  requireEnv('LANGSMITH_API_KEY');
  requireEnv('LANGSMITH_PROJECT');
  selfCheckFinalResponseEvaluators();

  const target = resolveLiveEvalTarget();
  if (target === 'production') {
    if (process.env.LIVE_EVAL_ALLOW_PRODUCTION !== 'true') {
      throw new Error(
        'Refusing production live eval. Set LIVE_EVAL_ALLOW_PRODUCTION=true if you intend to mutate a real workspace.',
      );
    }
    console.warn(
      'LIVE EVAL TARGET is production. This writes directories/documents and spends credits.',
    );
  } else {
    console.log(
      'Live eval target: emulator. Re-seed between full runs; this mutates the seed user workspace.',
    );
  }

  const projectId = resolveFirebaseProjectId();
  const streamUrl = resolveAgentMessageStreamUrl(projectId, target);
  const idToken = await mintLiveEvalIdToken({ target });
  console.log(`Streaming ${streamUrl}`);

  const client = new Client({ apiKey: process.env.LANGSMITH_API_KEY });
  const data = await loadDatasetEvalData(
    client,
    FINAL_RESPONSE_DATASET_NAME,
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
    evaluators: localFinalResponseEvaluators(),
    experimentPrefix: 'workspace-agent-live-v1',
    maxConcurrency: 1,
    metadata: {
      evalKind: 'live-agent',
      dataset: FINAL_RESPONSE_DATASET_NAME,
      liveEvalTarget: target,
      streamUrl,
    },
  });

  const experimentName =
    'experimentName' in results
      ? String(results.experimentName)
      : 'workspace-agent-live-v1';
  console.log(`Experiment: ${experimentName}`);
  console.log(`Dataset: ${FINAL_RESPONSE_DATASET_NAME}`);
  console.log('Metrics: no_canned_fallback, nonempty_reply, criteria_match');
  console.log(
    'Hosted Workspace Agent Criteria Match (score) runs on these outputs automatically.',
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
