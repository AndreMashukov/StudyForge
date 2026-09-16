#!/usr/bin/env npx tsx
/**
 * Retrieval experiment: searchPlatformKnowledge per dataset objective.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.base.json scripts/langsmith-eval/experiments/run-platform-knowledge-retrieval.ts
 */
import '../shared/emulator-env';
import { Client } from 'langsmith';
import { evaluate } from 'langsmith/evaluation';
import {
  retrievalRecallLangsmithEvaluators,
  selfCheckPlatformKnowledgeEvaluators,
} from '../evaluators/platform-knowledge';
import { PLATFORM_KNOWLEDGE_DATASET_NAME } from '../shared/constants';
import { loadEvalEnv, requireEnv } from '../shared/env';
import { loadDatasetEvalData, readMaxExamples } from '../shared/load-examples';
import { searchPlatformKnowledgeForEval } from '../targets/search-platform-knowledge';

loadEvalEnv();

async function main(): Promise<void> {
  requireEnv('LANGSMITH_API_KEY');
  requireEnv('LANGSMITH_PROJECT');
  selfCheckPlatformKnowledgeEvaluators();

  const first = await searchPlatformKnowledgeForEval(
    'How many credits does a document from prompt cost?',
  );
  console.log(
    `Pinned ${first.documentId} hash=${first.publishedContentHash} (probe retrieved ${first.retrievedTexts.length} chunk(s))`,
  );

  const client = new Client({ apiKey: process.env.LANGSMITH_API_KEY });
  const data = await loadDatasetEvalData(
    client,
    PLATFORM_KNOWLEDGE_DATASET_NAME,
    readMaxExamples(),
  );

  async function retrievalTarget(inputs: {
    objective?: string;
  }): Promise<{
    retrievedTexts: string[];
    documentId: string;
    publishedContentHash: string;
  }> {
    const objective =
      typeof inputs.objective === 'string' ? inputs.objective : '';
    if (!objective.trim()) {
      throw new Error('Example is missing inputs.objective');
    }
    return searchPlatformKnowledgeForEval(objective);
  }

  const results = await evaluate(retrievalTarget, {
    data,
    client,
    evaluators: retrievalRecallLangsmithEvaluators(),
    experimentPrefix: 'workspace-agent-pk-retrieval-v1',
    maxConcurrency: 1,
    metadata: {
      evalKind: 'platform-knowledge-retrieval',
      dataset: PLATFORM_KNOWLEDGE_DATASET_NAME,
      platformKnowledgeDocumentId: first.documentId,
      publishedContentHash: first.publishedContentHash,
    },
  });

  const experimentName =
    'experimentName' in results
      ? String(results.experimentName)
      : 'workspace-agent-pk-retrieval-v1';
  console.log(`Experiment: ${experimentName}`);
  console.log(`Dataset: ${PLATFORM_KNOWLEDGE_DATASET_NAME}`);
  console.log('Metric: retrieval_recall');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
