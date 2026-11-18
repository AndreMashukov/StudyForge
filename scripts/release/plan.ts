#!/usr/bin/env tsx
/**
 * Turn Release facts into a validated Release plan.
 *
 *   tsx scripts/release/plan.ts --facts .release/facts.json --out .release/plan.json --summary .release/plan.md [--preview]
 *
 * Diff mode calls the LLM (TOGETHER_API_KEY). If the LLM fails or keeps returning an invalid
 * plan, this exits non-zero and the release does not run. deploy-all mode never calls the LLM.
 * Outside --preview, blockers also exit non-zero (after writing the summary).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { hasFlag, requireArg } from './exec';
import { proposeWithLlm } from './llm';
import { mergePlan } from './plan-core';
import { renderPlanMarkdown } from './render';
import type { IReleaseFacts, IReleasePlan } from './schema';

function runUrl(): string | null {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  return GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : null;
}

async function main(): Promise<void> {
  const factsPath = requireArg('facts');
  const out = requireArg('out');
  const summaryPath = requireArg('summary');
  const preview = hasFlag('preview');

  // Facts are produced by facts.ts in the same job; parse is structural, not a trust boundary.
  const facts: IReleaseFacts = JSON.parse(readFileSync(factsPath, 'utf8'));

  if (!preview && !facts.online) {
    throw new Error('A deploy plan needs GCP access (deployed functions, secrets, Migration ledger). Re-run facts without --offline.');
  }

  let plan: IReleasePlan;
  if (facts.mode === 'deploy-all' || facts.changedFiles.length === 0) {
    plan = mergePlan(facts, null, null);
  } else {
    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) throw new Error('TOGETHER_API_KEY is not set — the release planner cannot run.');
    const result = await proposeWithLlm(facts, apiKey);
    console.log(`LLM plan accepted after ${result.attempts} attempt(s) (${result.model}).`);
    plan = mergePlan(facts, result.proposal, result.model);
  }

  writeFileSync(out, `${JSON.stringify(plan, null, 2)}\n`);
  writeFileSync(summaryPath, renderPlanMarkdown(plan, { preview, runUrl: runUrl() }));
  console.log(readFileSync(summaryPath, 'utf8'));

  if (!preview && plan.blockers.length > 0) {
    console.error(`Release blocked:\n- ${plan.blockers.join('\n- ')}`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
