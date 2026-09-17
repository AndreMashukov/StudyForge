#!/usr/bin/env npx tsx
/**
 * Application experiment: live agentMessageStream for platform-knowledge cases.
 * Returns same-turn finalReply + retrievedTexts for RAG LLM-as-judge metrics.
 *
 * Requires LANGSMITH_EVAL_EMIT_RETRIEVED_TEXTS=true in functions/.env.local and
 * a rebuilt functions emulator.
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
  ragLlmJudgeEvaluators,
  selfCheckRagLlmJudges,
} from '../evaluators/rag-llm-judges';
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
  streamWorkspaceAgentRagOutput,
} from '../shared/live-agent-client';
import { loadDatasetEvalData, readMaxExamples } from '../shared/load-examples';
import { readPlatformKnowledgePin } from '../targets/search-platform-knowledge';

loadEvalEnv();

function requireRetrievedTextsEmit(): void {
  if (process.env.LANGSMITH_EVAL_EMIT_RETRIEVED_TEXTS !== 'true') {
    throw new Error(
      'Set LANGSMITH_EVAL_EMIT_RETRIEVED_TEXTS=true in functions/.env.local, rebuild, and restart the functions emulator before running PK RAG evals.',
    );
  }
}

async function main(): Promise<void> {
  requireEnv('LANGSMITH_API_KEY');
  requireEnv('LANGSMITH_PROJECT');
  requireRetrievedTextsEmit();
  selfCheckPlatformKnowledgeEvaluators();
  selfCheckRagLlmJudges();

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
  }): Promise<{ finalReply: string; retrievedTexts: string[] }> {
    const objective =
      typeof inputs.objective === 'string' ? inputs.objective : '';
    if (!objective.trim()) {
      throw new Error('Example is missing inputs.objective');
    }
    const output = await streamWorkspaceAgentRagOutput({
      streamUrl,
      idToken,
      objective,
    });
    if (!output.retrievedTextsPresent) {
      throw new Error(
        'done.response is missing retrievedTexts. Rebuild functions with LANGSMITH_EVAL_EMIT_RETRIEVED_TEXTS=true and restart the emulator.',
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 3500));
    return {
      finalReply: output.finalReply,
      retrievedTexts: output.retrievedTexts,
    };
  }

  const results = await evaluate(liveWorkspaceAgent, {
    data,
    client,
    evaluators: [
      ...policyFactsLangsmithEvaluators(),
      ...ragLlmJudgeEvaluators(),
    ],
    experimentPrefix: 'workspace-agent-pk-rag-v1',
    maxConcurrency: 1,
    metadata: {
      evalKind: 'platform-knowledge-rag',
      dataset: PLATFORM_KNOWLEDGE_DATASET_NAME,
      liveEvalTarget: target,
      streamUrl,
      platformKnowledgeDocumentId: pin.documentId,
      publishedContentHash: pin.publishedContentHash,
      emitRetrievedTexts: true,
    },
  });

  const experimentName =
    'experimentName' in results
      ? String(results.experimentName)
      : 'workspace-agent-pk-rag-v1';
  console.log(`Experiment: ${experimentName}`);
  console.log(`Dataset: ${PLATFORM_KNOWLEDGE_DATASET_NAME}`);
  console.log(
    'Metrics: policy_facts, correctness, relevance, groundedness, retrieval_relevance',
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
