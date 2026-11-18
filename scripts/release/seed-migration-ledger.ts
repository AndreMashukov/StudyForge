#!/usr/bin/env tsx
/**
 * One-time seed of the Migration ledger: mark every script that exists today as applied
 * ("pre-ledger-seed") so the release pipeline never runs it automatically.
 * Until this has run, every release is blocked.
 *
 *   gcloud auth application-default login
 *   tsx scripts/release/seed-migration-ledger.ts           # dry-run: list what would be seeded
 *   tsx scripts/release/seed-migration-ledger.ts --write   # seed
 */
import { MIGRATIONS_DIR, PROJECT_ID } from './config';
import { hasFlag, runOrThrow } from './exec';
import { listMigrationScripts, seedLedger } from './migrations';

async function main(): Promise<void> {
  const write = hasFlag('write');
  // Seed exactly what HEAD contains: an uncommitted script must not be recorded as applied under HEAD.
  const dirty = runOrThrow('git', ['status', '--porcelain', '--', MIGRATIONS_DIR]).trim();
  if (dirty) throw new Error(`${MIGRATIONS_DIR} has uncommitted changes — commit or remove them first:\n${dirty}`);
  const scripts = listMigrationScripts();
  const sha = runOrThrow('git', ['rev-parse', 'HEAD']).trim();
  const seeded = await seedLedger(scripts, sha, write);

  console.log(`Project: ${PROJECT_ID}`);
  console.log(`${write ? 'Seeded' : 'Would seed'} ${seeded.length} of ${scripts.length} script(s):`);
  for (const script of seeded) console.log(`  - ${script}`);
  if (!write) console.log('\nDry-run only. Re-run with --write to seed.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
