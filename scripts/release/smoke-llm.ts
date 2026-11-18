#!/usr/bin/env tsx
/**
 * Check that the release planner model is reachable on Together's Anthropic-compatible
 * Messages endpoint before relying on it in CI.
 *
 *   TOGETHER_API_KEY=… tsx scripts/release/smoke-llm.ts
 */
import Anthropic from '@anthropic-ai/sdk';
import { LLM_BASE_URL, LLM_MODEL, LLM_TIMEOUT_MS } from './config';

async function main(): Promise<void> {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) throw new Error('Set TOGETHER_API_KEY');
  const client = new Anthropic({ baseURL: LLM_BASE_URL, apiKey: null, authToken: apiKey, timeout: LLM_TIMEOUT_MS, maxRetries: 0 });
  const started = Date.now();
  const message = await client.messages.create({
    model: LLM_MODEL,
    max_tokens: 2_000,
    messages: [{ role: 'user', content: 'Reply with exactly this JSON and nothing else: {"ok":true}' }],
  });
  const text = message.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
  console.log(`${LLM_MODEL} via ${LLM_BASE_URL}/v1/messages — ${Date.now() - started} ms`);
  console.log(`stop_reason=${message.stop_reason} usage=${JSON.stringify(message.usage)}`);
  console.log(`reply: ${text.trim()}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
