#!/usr/bin/env npx tsx
/**
 * Replay labeled workspace-agent traces and score them with local evaluators.
 * Uploaded LangSmith code evaluators can reuse the Python twins in this folder.
 */
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { Client } from 'langsmith';
import { evaluate } from 'langsmith/evaluation';
import {
  cannedFallbackEvaluator,
  extractFinalReply,
  nonemptyReplyEvaluator,
  type IEvalExampleLike,
  type IEvalRunLike,
} from './evaluators/workspace-agent-final-response';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), 'functions/.env.local') });

const DATASET_NAME = 'Workspace Agent: Final Response';
const DATASET_PATH = path.join(
  process.cwd(),
  'scripts/langsmith-eval/datasets/workspace-agent-final-response.json',
);
const CANNED_FALLBACK =
  'I completed the planned steps but could not compose a final reply.';

interface ILabeledExample {
  trace_id?: string;
  inputs: { objective?: string };
  outputs: Record<string, unknown>;
}

function isKvMap(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.includes('your-langsmith') || value.includes('your_')) {
    throw new Error(`${name} is missing`);
  }
  return value;
}

function selfCheckEvaluators(): void {
  const failRun: IEvalRunLike = { outputs: { finalReply: CANNED_FALLBACK } };
  const passRun: IEvalRunLike = {
    outputs: { finalReply: 'Here is a complete listing of Study Materials.' },
  };
  const example: IEvalExampleLike = {
    outputs: { mustNotContain: CANNED_FALLBACK },
  };

  const failScore = cannedFallbackEvaluator(failRun, example).score;
  const passScore = cannedFallbackEvaluator(passRun, example).score;
  const emptyScore = nonemptyReplyEvaluator({
    outputs: { finalReply: '' },
  }).score;
  if (failScore !== 0 || passScore !== 1 || emptyScore !== 0) {
    throw new Error(
      `Evaluator self-check failed: fallbackFail=${failScore} fallbackPass=${passScore} empty=${emptyScore}`,
    );
  }
  console.log(
    'Evaluator self-check passed (known good/bad finalReply shapes).',
  );
}

async function gradeCriteriaMatch(input: {
  objective: string;
  criteria: string;
  actual: string;
}): Promise<{ score: number; comment: string }> {
  const apiKey = process.env.TOGETHER_AI_API_KEY;
  if (!apiKey || apiKey.includes('your_') || apiKey.startsWith('demo-')) {
    return {
      score: 0,
      comment:
        'Skipped: TOGETHER_AI_API_KEY is missing, so criteria_match was not graded.',
    };
  }

  const prompt = [
    'You grade a StudyForge workspace agent final reply.',
    'Return ONLY JSON: {"score": 0 or 1, "comment": "short reason"}.',
    'score=1 if the actual reply satisfies the expected criteria. Partial-but-honest answers can score 1.',
    'score=0 if it invents ids, creates a forbidden artifact kind, uses the canned planner fallback, or misses the required behavior.',
    `User objective:\n${input.objective}`,
    `Expected criteria:\n${input.criteria}`,
    `Actual finalReply:\n${input.actual}`,
  ].join('\n\n');

  const response = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'zai-org/GLM-5.2',
      temperature: 0,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content:
            'Respond with JSON only: {"score": 0 or 1, "comment": "short reason"}',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      score: 0,
      comment: `Together judge HTTP ${response.status}: ${body.slice(0, 200)}`,
    };
  }

  const payload: unknown = await response.json();
  const text = stripJsonFence(readChatCompletionText(payload));
  const parsed = parseJudgeJson(text);
  if (!parsed) {
    return {
      score: 0,
      comment: `Judge returned unparseable JSON: ${text.slice(0, 200)}`,
    };
  }
  return parsed;
}

function readChatCompletionText(payload: unknown): string {
  if (!isKvMap(payload) || !Array.isArray(payload.choices)) {
    return '';
  }
  const first = payload.choices[0];
  if (!isKvMap(first) || !isKvMap(first.message)) {
    return '';
  }
  return typeof first.message.content === 'string' ? first.message.content : '';
}

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1].trim() : trimmed;
}

function parseJudgeJson(
  raw: string,
): { score: number; comment: string } | null {
  const candidates = [stripJsonFence(raw)];
  const embedded = raw.match(/\{[\s\S]*\}/);
  if (embedded) {
    candidates.push(embedded[0]);
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (!isKvMap(parsed)) {
        continue;
      }
      const score = parsed.score === 1 || parsed.score === true ? 1 : 0;
      const comment =
        typeof parsed.comment === 'string' ? parsed.comment : 'No comment';
      return { score, comment };
    } catch {
      continue;
    }
  }

  if (/"score"\s*:\s*1\b/.test(raw)) {
    return {
      score: 1,
      comment: 'Judge JSON was truncated; score field was 1.',
    };
  }
  if (/"score"\s*:\s*0\b/.test(raw)) {
    return {
      score: 0,
      comment: 'Judge JSON was truncated; score field was 0.',
    };
  }
  return null;
}

async function main(): Promise<void> {
  requireEnv('LANGSMITH_API_KEY');
  requireEnv('LANGSMITH_PROJECT');
  selfCheckEvaluators();

  const labeled = readLabeledExamples();
  const client = new Client({ apiKey: process.env.LANGSMITH_API_KEY });
  await client.readDataset({ datasetName: DATASET_NAME });

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
    data: DATASET_NAME,
    client,
    evaluators: [
      async ({ run, example }) => cannedFallbackEvaluator(run, example),
      async ({ run }) => nonemptyReplyEvaluator(run),
      async ({ run, example }) => {
        const actual = extractFinalReply(run);
        const outputs = isKvMap(example.outputs) ? example.outputs : {};
        const criteria =
          typeof outputs.finalReply === 'string'
            ? outputs.finalReply
            : 'Satisfy the labeled case.';
        const objective =
          isKvMap(example.inputs) &&
          typeof example.inputs.objective === 'string'
            ? example.inputs.objective
            : '';
        const grade = await gradeCriteriaMatch({
          objective,
          criteria,
          actual,
        });
        return {
          key: 'criteria_match',
          score: grade.score,
          comment: grade.comment,
        };
      },
    ],
    experimentPrefix: 'workspace-agent-replay-v3',
    maxConcurrency: 2,
    metadata: {
      evalKind: 'trace-replay',
      dataset: DATASET_NAME,
    },
  });

  const experimentName =
    'experimentName' in results
      ? String(results.experimentName)
      : 'workspace-agent-replay-v1';
  console.log(`Experiment: ${experimentName}`);
  console.log(`Dataset: ${DATASET_NAME}`);
  console.log('Metrics: no_canned_fallback, nonempty_reply, criteria_match');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
