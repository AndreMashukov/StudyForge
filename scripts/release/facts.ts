#!/usr/bin/env tsx
/**
 * Collect deterministic Release facts for a base..head range.
 *
 * Usage (repo root, after `nx run functions:build` and functions deps install):
 *   tsx scripts/release/facts.ts --base <sha> --head <sha> --out .release/facts.json [--deploy-all] [--offline]
 *
 * --offline skips GCP reads (deployed functions, secrets, Migration ledger) for previews without credentials.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import {
  FORCE_ALL_FUNCTION_PATHS,
  FUNCTIONS_ENTRY,
  MIGRATIONS_DIR,
  PROJECT_ID,
  REGION,
  RULES_FILES,
} from './config';
import { hasFlag, requireArg, runOrThrow } from './exec';
import {
  buildClosures,
  discoverExports,
  parseIndexModules,
  remappedExports,
  runtimeChanged,
  type IClosures,
  type IIndexModules,
} from './function-graph';
import { changedFiles, diffExcerpt, fileAt } from './git';
import { listMigrationScripts, readLedger, readMigration } from './migrations';
import type { IFunctionExport, IGraphHit, IPendingMigration, IReleaseFacts } from './schema';

function jsonSection(source: string | null, key: string): string {
  if (source === null) return '<missing>';
  try {
    const parsed: unknown = JSON.parse(source);
    const record = z.record(z.string(), z.unknown()).safeParse(parsed);
    return record.success ? JSON.stringify(record.data[key] ?? null) : '<invalid>';
  } catch {
    return '<invalid>';
  }
}

function webFacts(base: string, head: string, changed: string[], deployAll: boolean): IReleaseFacts['web'] {
  if (deployAll) return { deploy: true, reasons: ['deploy_all'] };
  const reasons: string[] = [];
  const output = runOrThrow('yarn', ['--silent', 'nx', 'show', 'projects', '--affected', `--base=${base}`, `--head=${head}`, '--json'], {
    env: { ...process.env, NX_DAEMON: 'false', NX_ISOLATE_PLUGINS: 'false' },
  });
  const lastLine = output.trim().split('\n').pop() ?? '[]';
  const affected = z.array(z.string()).parse(JSON.parse(lastLine));
  if (affected.includes('web')) reasons.push('nx: project `web` is affected');
  if (changed.includes('firebase.json') && jsonSection(fileAt(base, 'firebase.json'), 'hosting') !== jsonSection(fileAt(head, 'firebase.json'), 'hosting')) {
    reasons.push('firebase.json `hosting` section changed');
  }
  return { deploy: reasons.length > 0, reasons };
}

function closureFor(name: string, index: IIndexModules, closures: IClosures): { module: string | null; files: Set<string> } {
  const specifier = index.reExports.get(name);
  if (specifier !== undefined) {
    return { module: specifier, files: closures.modules.get(specifier) ?? new Set() };
  }
  if (index.inlineExports.includes(name)) {
    return { module: 'index', files: new Set([...closures.preamble, FUNCTIONS_ENTRY]) };
  }
  // Unmapped (e.g. from `export *`): assume it depends on everything.
  const all = new Set<string>([...closures.preamble, FUNCTIONS_ENTRY]);
  for (const files of closures.modules.values()) for (const file of files) all.add(file);
  return { module: null, files: all };
}

/** Deployed function name → the service account it runs as (null when the API omits it). */
function deployedFunctions(): Map<string, string | null> {
  const output = runOrThrow('gcloud', [
    'functions',
    'list',
    `--regions=${REGION}`,
    `--project=${PROJECT_ID}`,
    '--format=json(name,serviceConfig.serviceAccountEmail)',
  ]);
  const parsed = z
    .array(z.object({ name: z.string(), serviceConfig: z.object({ serviceAccountEmail: z.string().optional() }).optional() }))
    .parse(JSON.parse(output || '[]'));
  return new Map(parsed.map((entry) => [entry.name.split('/').pop() ?? entry.name, entry.serviceConfig?.serviceAccountEmail ?? null]));
}

function existingSecrets(): Set<string> {
  const output = runOrThrow('gcloud', ['secrets', 'list', `--project=${PROJECT_ID}`, '--format=value(name)']);
  return new Set(
    output
      .split('\n')
      .map((line) => line.trim().split('/').pop() ?? '')
      .filter(Boolean),
  );
}

async function main(): Promise<void> {
  const base = requireArg('base');
  const head = requireArg('head');
  const out = requireArg('out');
  const deployAll = hasFlag('deploy-all');
  const online = !hasFlag('offline');

  // Resolve to full SHAs so the plan is unambiguous.
  const baseSha = runOrThrow('git', ['rev-parse', base]).trim();
  const headSha = runOrThrow('git', ['rev-parse', head]).trim();
  const changed = changedFiles(baseSha, headSha);
  const changedSet = new Set(changed);

  // --- functions --------------------------------------------------------
  const headIndexSource = readFileSync(FUNCTIONS_ENTRY, 'utf8');
  const headIndex = parseIndexModules(headIndexSource);
  const baseIndexSource = fileAt(baseSha, FUNCTIONS_ENTRY);
  const baseIndex = baseIndexSource === null ? null : parseIndexModules(baseIndexSource);
  const closures = await buildClosures(headIndex);
  const discovered = discoverExports();

  // Only files whose compiled JS changed count for the graph (type-only edits to a shared barrel
  // like libs/shared-types would otherwise mark nearly every function as affected).
  const closureFiles = new Set<string>(closures.preamble);
  for (const files of closures.modules.values()) for (const file of files) closureFiles.add(file);
  const runtimeChangedFiles = new Set<string>();
  const typeOnlyChanges: string[] = [];
  for (const file of changed) {
    if (!closureFiles.has(file)) continue;
    if (await runtimeChanged(file, fileAt(baseSha, file), fileAt(headSha, file))) runtimeChangedFiles.add(file);
    else typeOnlyChanges.push(file);
  }

  const forceAllReasons: string[] = [];
  if (deployAll) forceAllReasons.push('deploy_all');
  for (const path of FORCE_ALL_FUNCTION_PATHS) {
    if (changedSet.has(path)) forceAllReasons.push(`${path} changed (affects the whole bundle)`);
  }
  for (const file of closures.preamble) {
    if (runtimeChangedFiles.has(file)) forceAllReasons.push(`${file} changed (imported by index.ts before every function)`);
  }
  if (
    changedSet.has('firebase.json') &&
    jsonSection(fileAt(baseSha, 'firebase.json'), 'functions') !== jsonSection(fileAt(headSha, 'firebase.json'), 'functions')
  ) {
    forceAllReasons.push('firebase.json `functions` section changed');
  }

  const moved = new Set(baseIndex ? remappedExports(baseIndex, headIndex) : []);
  const indexChanged = changedSet.has(FUNCTIONS_ENTRY);

  const deployed = online ? deployedFunctions() : null;
  const secrets = online ? existingSecrets() : null;

  const exports: IFunctionExport[] = [];
  const graphAffected: IGraphHit[] = [];
  for (const entry of discovered) {
    const { module, files } = closureFor(entry.name, headIndex, closures);
    exports.push({ ...entry, module, deployed: deployed ? deployed.has(entry.name) : null });

    const reasons = [...files].filter((file) => runtimeChangedFiles.has(file) && file !== FUNCTIONS_ENTRY).sort();
    const hitReasons = reasons.map((file) => `imports changed ${file}`);
    if (moved.has(entry.name)) hitReasons.push('export now comes from a different module in index.ts');
    if (module === 'index' && indexChanged) hitReasons.push('defined inline in index.ts, which changed');
    if (hitReasons.length > 0) graphAffected.push({ name: entry.name, reasons: hitReasons });
  }

  const exportNames = new Set(exports.map((entry) => entry.name));
  const deletedFunctions = deployed ? [...deployed.keys()].filter((name) => !exportNames.has(name)).sort() : [];
  const runtimeServiceAccounts = deployed
    ? [...new Set([...deployed.values()].filter((email): email is string => email !== null))].sort()
    : [];
  const referencedSecrets = new Set(exports.flatMap((entry) => entry.secrets));
  const missingSecrets = secrets ? [...referencedSecrets].filter((name) => !secrets.has(name)).sort() : [];

  // --- migrations ---------------------------------------------------------
  const scripts = listMigrationScripts();
  let ledgerSeeded: boolean | null = null;
  let pendingScripts: string[];
  if (online) {
    const ledger = await readLedger();
    ledgerSeeded = ledger.seeded;
    pendingScripts = scripts.filter((script) => !ledger.applied.has(script));
  } else {
    // Offline preview: best effort — only scripts touched by this diff.
    pendingScripts = scripts.filter((script) => changedSet.has(`${MIGRATIONS_DIR}/${script}`));
  }
  const pending: IPendingMigration[] = pendingScripts.map((script) => ({
    script,
    ...readMigration(script),
    changedInDiff: changedSet.has(`${MIGRATIONS_DIR}/${script}`),
  }));

  const facts: IReleaseFacts = {
    project: PROJECT_ID,
    base: baseSha,
    head: headSha,
    mode: deployAll ? 'deploy-all' : 'diff',
    online,
    changedFiles: changed,
    web: webFacts(baseSha, headSha, changed, deployAll),
    rules: {
      firestoreRules: deployAll || changedSet.has(RULES_FILES.firestoreRules),
      firestoreIndexes: deployAll || changedSet.has(RULES_FILES.firestoreIndexes),
      storageRules: deployAll || changedSet.has(RULES_FILES.storageRules),
    },
    functions: {
      exports,
      forceAll: { value: forceAllReasons.length > 0, reasons: forceAllReasons },
      graphAffected,
      typeOnlyChanges,
      deletedFunctions,
      missingSecrets,
      runtimeServiceAccounts,
    },
    migrations: { ledgerSeeded, pending },
    diff: diffExcerpt(baseSha, headSha, changed),
  };

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(facts, null, 2)}\n`);
  const summary = [
    `changed files: ${changed.length}`,
    `web: ${facts.web.deploy}`,
    `functions graph-affected: ${graphAffected.length}/${exports.length}${facts.functions.forceAll.value ? ' (force all)' : ''}`,
    `pending migrations: ${pending.length}`,
  ];
  console.log(`Release facts → ${out}\n  ${summary.join('\n  ')}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
