#!/usr/bin/env tsx
/**
 * Execute one step of a validated Release plan. Every command is spawned with an argument
 * array (no shell), and every name is re-checked against a strict pattern before use.
 *
 *   tsx scripts/release/execute.ts outputs    --plan .release/plan.json   # GitHub step outputs
 *   tsx scripts/release/execute.ts rules      --plan …                    # rules + indexes (no wait, no deletes)
 *   tsx scripts/release/execute.ts migrations --plan … --phase pre-functions|post-functions
 *   tsx scripts/release/execute.ts functions  --plan …
 *   tsx scripts/release/execute.ts iam        --plan …
 *   tsx scripts/release/execute.ts hosting    --plan …
 */
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MIGRATIONS_DIR, PROJECT_ID, REGION } from './config';
import { readArg, requireArg, runOrThrow } from './exec';
import { isApplied, recordApplied } from './migrations';
import { TASK_QUEUE_PATTERN, TOPIC_PATTERN } from './plan-core';
import { MIGRATION_PHASES, type IReleasePlan, type MigrationPhase } from './schema';

const FIREBASE = './node_modules/.bin/firebase';
const TSX = './node_modules/.bin/tsx';
const FUNCTION_NAME = /^[A-Za-z][A-Za-z0-9_]{0,62}$/;
const SCRIPT_NAME = /^[A-Za-z0-9._-]+\.(ts|mjs|js)$/;
const OUTPUT_TAIL_CHARS = 4_000;

function loadPlan(): IReleasePlan {
  const plan: IReleasePlan = JSON.parse(readFileSync(requireArg('plan'), 'utf8'));
  if (plan.version !== 1 || plan.project !== PROJECT_ID) {
    throw new Error(`Plan is for ${plan.project} v${plan.version}; expected ${PROJECT_ID} v1`);
  }
  if (plan.blockers.length > 0) throw new Error(`Plan has blockers:\n- ${plan.blockers.join('\n- ')}`);
  return plan;
}

function assertFunctionName(name: string): string {
  if (!FUNCTION_NAME.test(name)) throw new Error(`Refusing unsafe function name: ${name}`);
  return name;
}

function runUrl(): string | null {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  return GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : null;
}

/** Stream output live and keep the tail for the ledger. */
function runStreaming(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<{ status: number; tail: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const onData = (chunk: Buffer, stream: NodeJS.WriteStream) => {
      stream.write(chunk);
      tail = (tail + chunk.toString('utf8')).slice(-OUTPUT_TAIL_CHARS);
    };
    child.stdout.on('data', (chunk: Buffer) => onData(chunk, process.stdout));
    child.stderr.on('data', (chunk: Buffer) => onData(chunk, process.stderr));
    child.on('error', reject);
    child.on('close', (code) => resolvePromise({ status: code ?? 1, tail }));
  });
}

async function firebaseDeploy(only: string[], message: string): Promise<void> {
  const args = ['deploy', '--only', only.join(','), '--project', PROJECT_ID, '--non-interactive', '--message', message];
  console.log(`$ firebase ${args.join(' ')}`);
  const { status } = await runStreaming(FIREBASE, args);
  if (status !== 0) throw new Error(`firebase deploy --only ${only.join(',')} failed (${status})`);
}

function writeOutputs(plan: IReleasePlan): void {
  const target = process.env.GITHUB_OUTPUT;
  const lines = {
    web: String(plan.web.deploy),
    rules: String(plan.rules.firestoreRules || plan.rules.firestoreIndexes || plan.rules.storageRules),
    functions: String(plan.functions.length > 0),
    iam: String(plan.iamGrants.length > 0),
    migrations_pre: String(plan.migrations.some((entry) => entry.phase === 'pre-functions')),
    migrations_post: String(plan.migrations.some((entry) => entry.phase === 'post-functions')),
  };
  const text = Object.entries(lines).map(([key, value]) => `${key}=${value}`).join('\n');
  if (target) appendFileSync(target, `${text}\n`);
  console.log(text);
}

async function deployRules(plan: IReleasePlan): Promise<void> {
  const only = [
    plan.rules.firestoreRules && 'firestore:rules',
    // Without --force the CLI never deletes indexes that exist remotely but not in the file.
    plan.rules.firestoreIndexes && 'firestore:indexes',
    plan.rules.storageRules && 'storage',
  ].filter((value): value is string => typeof value === 'string');
  if (only.length === 0) return;
  await firebaseDeploy(only, `release ${plan.head.slice(0, 7)} rules`);
  if (plan.rules.firestoreIndexes) {
    console.log('Index builds continue in the background (not awaited).');
  }
}

function isPhase(value: string | null): value is MigrationPhase {
  return MIGRATION_PHASES.some((phase) => phase === value);
}

async function runMigrations(plan: IReleasePlan): Promise<void> {
  const phase = readArg('phase');
  if (!isPhase(phase)) throw new Error(`--phase must be one of ${MIGRATION_PHASES.join(', ')}`);

  const env = { ...process.env, GCLOUD_PROJECT: PROJECT_ID, GOOGLE_CLOUD_PROJECT: PROJECT_ID };
  for (const migration of plan.migrations.filter((entry) => entry.phase === phase)) {
    if (!SCRIPT_NAME.test(migration.script)) throw new Error(`Refusing unsafe script name: ${migration.script}`);
    const path = join(MIGRATIONS_DIR, migration.script);
    if (!existsSync(path)) throw new Error(`${path} does not exist`);

    if (await isApplied(migration.script)) {
      console.log(`↷ ${migration.script} already in the Migration ledger — skipping`);
      continue;
    }

    console.log(`\n▶ ${migration.script} [${phase}] dry-run`);
    const dryRun = await runStreaming(TSX, [path], env);
    if (dryRun.status !== 0) throw new Error(`${migration.script} dry-run failed (${dryRun.status}); nothing written`);

    console.log(`\n▶ ${migration.script} [${phase}] --write`);
    const write = await runStreaming(TSX, [path, '--write'], env);
    if (write.status !== 0) throw new Error(`${migration.script} --write failed (${write.status}); not recorded, will retry next release`);

    await recordApplied({
      script: migration.script,
      phase,
      commitSha: plan.head,
      runUrl: runUrl(),
      dryRunTail: dryRun.tail,
      writeTail: write.tail,
    });
    console.log(`✓ ${migration.script} recorded in the Migration ledger`);
  }
}

async function deployFunctions(plan: IReleasePlan): Promise<void> {
  if (plan.functions.length === 0) return;
  // Always an explicit list: `--only functions` would try to delete functions missing from source.
  const only = plan.functions.map((entry) => `functions:${assertFunctionName(entry.name)}`);
  await firebaseDeploy(only, `release ${plan.head.slice(0, 7)} functions`);
}

function grantIam(plan: IReleasePlan): void {
  for (const grant of plan.iamGrants) {
    const common = [`--member=${grant.member}`, `--project=${PROJECT_ID}`];
    let args: string[];
    if (grant.resourceType === 'function' && grant.role === 'roles/run.invoker') {
      args = ['functions', 'add-invoker-policy-binding', assertFunctionName(grant.resource), `--region=${REGION}`, ...common];
    } else if (grant.resourceType === 'taskQueue' && grant.role === 'roles/cloudtasks.enqueuer') {
      if (!TASK_QUEUE_PATTERN.test(grant.resource)) throw new Error(`Refusing unsafe queue id: ${grant.resource}`);
      args = ['tasks', 'queues', 'add-iam-policy-binding', grant.resource, `--location=${REGION}`, `--role=${grant.role}`, ...common];
    } else if (grant.resourceType === 'pubsubTopic' && grant.role === 'roles/pubsub.publisher') {
      if (!TOPIC_PATTERN.test(grant.resource)) throw new Error(`Refusing unsafe topic id: ${grant.resource}`);
      args = ['pubsub', 'topics', 'add-iam-policy-binding', grant.resource, `--role=${grant.role}`, ...common];
    } else {
      throw new Error(`Grant not on the allowlist: ${grant.role} on ${grant.resourceType}`);
    }
    console.log(`$ gcloud ${args.join(' ')}`);
    runOrThrow('gcloud', [...args, '--quiet', '--format=none']);
    console.log(`✓ ${grant.role} on ${grant.resource} → ${grant.member} (${grant.source})`);
  }
}

async function deployHosting(plan: IReleasePlan): Promise<void> {
  if (!plan.web.deploy) return;
  await firebaseDeploy(['hosting'], `release ${plan.head.slice(0, 7)} web`);
}

async function main(): Promise<void> {
  const step = process.argv[2];
  const plan = loadPlan();
  switch (step) {
    case 'outputs':
      return writeOutputs(plan);
    case 'rules':
      return deployRules(plan);
    case 'migrations':
      return runMigrations(plan);
    case 'functions':
      return deployFunctions(plan);
    case 'iam':
      return grantIam(plan);
    case 'hosting':
      return deployHosting(plan);
    default:
      throw new Error(`Unknown step "${step}". Use outputs|rules|migrations|functions|iam|hosting.`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
