#!/usr/bin/env npx tsx
/**
 * Replay labeled workspace-agent traces and score them with local evaluators.
 *
 * Usage:
 *   npx tsx scripts/langsmith-eval/experiments/run-final-response-replay.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'langsmith';
import { evaluate } from 'langsmith/evaluation';
import { extractFinalReply } from '../evaluators/final-response';
import {
  localFinalResponseEvaluators,
  selfCheckFinalResponseEvaluators,
} from '../evaluators/local-criteria-match';
import { FINAL_RESPONSE_DATASET_NAME } from '../shared/constants';
import { isKvMap } from '../shared/eval-types';
import { loadEvalEnv, requireEnv } from '../shared/env';

loadEvalEnv();

const DATASET_PATH = path.join(
  process.cwd(),
  'scripts/langsmith-eval/datasets/workspace-agent-final-response.json',
);

interface ILabeledExample {
  trace_id?: string;
  inputs: { objective?: string };
  outputs: Record<string, unknown>;
}

function readLabeledExamples(): ILabeledExample[] {
  const parsed: unknown = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error('Dataset file must be a JSON array');
  }
  return parsed.filter((entry): entry is ILabeledExample => {
    return (
      isKvMap(entry) &&
      isKvMap(entry.inputs) &&
      isKvMap(entry.outputs) &&
      typeof entry.trace_id === 'string'
    );
  });
}

async function main(): Promise<void> {
  requireEnv('LANGSMITH_API_KEY');
  requireEnv('LANGSMITH_PROJECT');
  selfCheckFinalResponseEvaluators();

  const labeled = readLabeledExamples();
  const client = new Client({ apiKey: process.env.LANGSMITH_API_KEY });
  await client.readDataset({ datasetName: FINAL_RESPONSE_DATASET_NAME });

  const traceByObjective = new Map<string, string>();
  for (const example of labeled) {
    const objective = example.inputs.objective;
    if (objective && example.trace_id) {
      traceByObjective.set(objective, example.trace_id);
    }
  }

  async function replayLabeledTrace(inputs: {
    objective?: string;
  }): Promise<{ finalReply: string }> {
    const objective =
      typeof inputs.objective === 'string' ? inputs.objective : '';
    const traceId = traceByObjective.get(objective);
    if (!traceId) {
      throw new Error(`No labeled trace_id for objective: ${objective}`);
    }
    const traced = await client.readRun(traceId);
    return { finalReply: extractFinalReply(traced) };
  }

  const results = await evaluate(replayLabeledTrace, {
    data: FINAL_RESPONSE_DATASET_NAME,
    client,
    evaluators: localFinalResponseEvaluators(),
    experimentPrefix: 'workspace-agent-replay-v3',
    maxConcurrency: 2,
    metadata: {
      evalKind: 'trace-replay',
      dataset: FINAL_RESPONSE_DATASET_NAME,
    },
  });

  const experimentName =
    'experimentName' in results
      ? String(results.experimentName)
      : 'workspace-agent-replay-v1';
  console.log(`Experiment: ${experimentName}`);
  console.log(`Dataset: ${FINAL_RESPONSE_DATASET_NAME}`);
  console.log('Metrics: no_canned_fallback, nonempty_reply, criteria_match');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
