#!/usr/bin/env node
/**
 * POC: 50 concurrent Together AI chat completions via MiniMax M3.
 *
 * Usage:
 *   yarn test:together-concurrency
 *
 * Requires TOGETHER_AI_API_KEY in the environment (or .env / .env.local).
 */

import * as path from 'path';
import { config } from 'dotenv';
import Together from 'together-ai';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

const MODEL = 'MiniMaxAI/MiniMax-M3';
const TOGETHER_BASE_URL = 'https://api.together.ai/v1/';
const CONCURRENCY = 50;
const PREVIEW_LENGTH = 120;

interface IInvocationResult {
  index: number;
  durationMs: number;
  preview: string;
}

function getApiKey(): string {
  const apiKey = process.env.TOGETHER_AI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'TOGETHER_AI_API_KEY is not set. Add it to .env or export it before running.'
    );
  }
  return apiKey;
}

function previewText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= PREVIEW_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, PREVIEW_LENGTH)}…`;
}

async function invokeOnce(
  together: Together,
  index: number
): Promise<IInvocationResult> {
  const startedAt = Date.now();

  const response = await together.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: `Return a one-sentence concurrency test response for request #${index}.`,
      },
    ],
    max_tokens: 512,
  });

  const content = response.choices[0]?.message?.content;
  if (!content?.trim()) {
    throw new Error(`Request #${index} returned empty content`);
  }

  return {
    index,
    durationMs: Date.now() - startedAt,
    preview: previewText(content),
  };
}

async function main(): Promise<void> {
  const apiKey = getApiKey();
  const together = new Together({
    apiKey,
    // Trailing slash marks baseURL as overridden so chat completions use api.together.ai
    // instead of the SDK default inference host (which returns 404 for MiniMax M3).
    baseURL: TOGETHER_BASE_URL,
  });

  console.log(`Starting ${CONCURRENCY} concurrent Together AI invocations`);
  console.log(`Model: ${MODEL}`);

  const batchStartedAt = Date.now();
  const settled = await Promise.allSettled(
    Array.from({ length: CONCURRENCY }, (_, offset) =>
      invokeOnce(together, offset + 1)
    )
  );
  const batchDurationMs = Date.now() - batchStartedAt;

  const successes: IInvocationResult[] = [];
  const failures: Array<{ index: number; reason: string }> = [];

  settled.forEach((result, offset) => {
    const index = offset + 1;
    if (result.status === 'fulfilled') {
      successes.push(result.value);
      return;
    }

    const reason =
      result.reason instanceof Error
        ? result.reason.message
        : String(result.reason);
    failures.push({ index, reason });
  });

  successes
    .sort((left, right) => left.index - right.index)
    .forEach((result) => {
      console.log(
        `[ok] #${result.index} ${result.durationMs}ms — ${result.preview}`
      );
    });

  failures
    .sort((left, right) => left.index - right.index)
    .forEach((failure) => {
      console.error(`[fail] #${failure.index} — ${failure.reason}`);
    });

  const durations = successes.map((result) => result.durationMs);
  const minMs = durations.length > 0 ? Math.min(...durations) : 0;
  const maxMs = durations.length > 0 ? Math.max(...durations) : 0;
  const avgMs =
    durations.length > 0
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : 0;

  console.log('');
  console.log('Summary');
  console.log(`  Total wall time: ${batchDurationMs}ms`);
  console.log(`  Successes: ${successes.length}/${CONCURRENCY}`);
  console.log(`  Failures: ${failures.length}/${CONCURRENCY}`);
  console.log(`  Per-call latency (ms): min=${minMs}, avg=${avgMs}, max=${maxMs}`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fatal error: ${message}`);
  process.exit(1);
});
