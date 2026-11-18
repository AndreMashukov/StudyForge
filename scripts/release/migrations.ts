/**
 * Migration scripts and the Migration ledger.
 *
 * A script is eligible for a release only when it declares a Release phase in its header:
 *   @release-phase pre-functions    (new function code needs the migrated data)
 *   @release-phase post-functions   (new code handles both shapes; backfill afterwards)
 * and has no ledger entry. Scripts must dry-run by default and apply only with --write.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LEDGER_COLLECTION, LEDGER_META_DOC, MIGRATIONS_DIR, PROJECT_ID } from './config';
import { MIGRATION_PHASES, type MigrationPhase } from './schema';

const HEADER_MAX_CHARS = 1_500;

export function listMigrationScripts(dir = MIGRATIONS_DIR): string[] {
  return readdirSync(dir)
    .filter((name) => /\.(ts|mjs|js)$/.test(name) && !/\.(spec|test)\./.test(name))
    .sort();
}

function isPhase(value: string): value is MigrationPhase {
  return MIGRATION_PHASES.some((phase) => phase === value);
}

/** The leading comment block (block comment or `//` lines after an optional shebang). */
export function extractHeader(source: string): string {
  const withoutShebang = source.replace(/^#!.*\n/, '');
  const block = withoutShebang.match(/^\s*\/\*[\s\S]*?\*\//);
  if (block) return block[0].trim().slice(0, HEADER_MAX_CHARS);
  const lines: string[] = [];
  for (const line of withoutShebang.split('\n')) {
    if (/^\s*\/\//.test(line)) lines.push(line);
    else if (lines.length > 0 || line.trim() !== '') break;
  }
  return lines.join('\n').slice(0, HEADER_MAX_CHARS);
}

export function parsePhase(header: string): MigrationPhase | null {
  // The whole token must be a phase: `post-functions2` is untagged, not `post-functions`.
  const match = header.match(/@release-phase\s+([a-z-]+)(?=\s|\*\/|$)/);
  if (!match) return null;
  return isPhase(match[1]) ? match[1] : null;
}

export function readMigration(script: string, dir = MIGRATIONS_DIR): { header: string; phase: MigrationPhase | null } {
  const header = extractHeader(readFileSync(join(dir, script), 'utf8'));
  return { header, phase: parsePhase(header) };
}

// ---------------------------------------------------------------------------
// Ledger (Firestore, Admin SDK with application default credentials)
// ---------------------------------------------------------------------------

export interface ILedgerState {
  seeded: boolean;
  applied: Set<string>;
}

async function firestore() {
  const admin = await import('firebase-admin');
  const app = admin.apps.length > 0 && admin.apps[0] ? admin.apps[0] : admin.initializeApp({ projectId: PROJECT_ID });
  return app.firestore();
}

export async function readLedger(): Promise<ILedgerState> {
  const db = await firestore();
  const [meta, entries] = await Promise.all([db.doc(LEDGER_META_DOC).get(), db.collection(LEDGER_COLLECTION).get()]);
  return { seeded: meta.exists, applied: new Set(entries.docs.map((doc) => doc.id)) };
}

export interface ILedgerEntry {
  script: string;
  phase: MigrationPhase | 'pre-ledger-seed';
  commitSha: string;
  runUrl: string | null;
  dryRunTail: string;
  writeTail: string;
}

/** create() fails if the entry already exists, so two runs can never both record a script. */
export async function recordApplied(entry: ILedgerEntry): Promise<void> {
  const db = await firestore();
  const admin = await import('firebase-admin');
  await db
    .collection(LEDGER_COLLECTION)
    .doc(entry.script)
    .create({ ...entry, appliedAt: admin.firestore.FieldValue.serverTimestamp() });
}

export async function isApplied(script: string): Promise<boolean> {
  const db = await firestore();
  return (await db.collection(LEDGER_COLLECTION).doc(script).get()).exists;
}

export async function seedLedger(scripts: string[], commitSha: string, write: boolean): Promise<string[]> {
  const db = await firestore();
  const admin = await import('firebase-admin');
  // A second seed would mark migrations added since the first one as applied without running them.
  if ((await db.doc(LEDGER_META_DOC).get()).exists) {
    throw new Error(`The Migration ledger is already seeded (${LEDGER_META_DOC}); refusing to seed again.`);
  }
  const existing = new Set((await db.collection(LEDGER_COLLECTION).get()).docs.map((doc) => doc.id));
  const toSeed = scripts.filter((script) => !existing.has(script));
  if (!write) return toSeed;

  const batch = db.batch();
  for (const script of toSeed) {
    batch.create(db.collection(LEDGER_COLLECTION).doc(script), {
      script,
      phase: 'pre-ledger-seed',
      commitSha,
      runUrl: null,
      dryRunTail: '',
      writeTail: '',
      appliedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  // create(): if another seed won the race, the whole batch fails and nothing is marked applied.
  batch.create(db.doc(LEDGER_META_DOC), {
    seededAt: admin.firestore.FieldValue.serverTimestamp(),
    seededScripts: scripts,
    commitSha,
  });
  await batch.commit();
  return toSeed;
}
