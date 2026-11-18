/**
 * Deterministic function facts:
 * - which exports the bundle actually registers (by loading it, like the Firebase CLI does),
 * - which source module each export comes from (by parsing functions/src/index.ts),
 * - the import closure of each module (esbuild metafile).
 *
 * All functions ship in one esbuild bundle, so the bundle hash can't tell which function
 * changed. The closure of the module an export comes from can.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import ts from 'typescript';
import { z } from 'zod';
import { FUNCTIONS_BUNDLE, PROJECT_ID } from './config';
import { run } from './exec';
import type { TriggerKind } from './schema';

const FUNCTIONS_SRC = 'functions/src';

// ---------------------------------------------------------------------------
// index.ts parsing (pure)
// ---------------------------------------------------------------------------

export interface IIndexModules {
  /** exported name → module specifier relative to functions/src */
  reExports: Map<string, string>;
  /** exported name → the binding it re-exports (`x` in `export { x as name }`) */
  reExportBindings: Map<string, string>;
  /** names declared directly in index.ts (`export const x = …`) */
  inlineExports: string[];
  /** non-export import statements: run for every function before any endpoint module */
  preambleImports: string[];
  /** `export * from` specifiers — their export names are unknown statically */
  starModules: string[];
}

export function parseIndexModules(source: string): IIndexModules {
  const file = ts.createSourceFile('index.ts', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const reExports = new Map<string, string>();
  const reExportBindings = new Map<string, string>();
  const inlineExports: string[] = [];
  const preambleImports: string[] = [];
  const starModules: string[] = [];

  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement)) {
      preambleImports.push(statement.getText(file));
      continue;
    }

    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      const clause = statement.exportClause;
      if (!clause) {
        starModules.push(specifier);
      } else if (ts.isNamedExports(clause)) {
        for (const element of clause.elements) {
          reExports.set(element.name.text, specifier);
          reExportBindings.set(element.name.text, (element.propertyName ?? element.name).text);
        }
      }
      continue;
    }

    const isExported =
      ts.canHaveModifiers(statement) &&
      (ts.getModifiers(statement) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExported) continue;

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) inlineExports.push(declaration.name.text);
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      inlineExports.push(statement.name.text);
    }
  }

  return { reExports, reExportBindings, inlineExports, preambleImports, starModules };
}

/**
 * index.ts without its exports: the imports and top-level calls (e.g. applyLangSmithProcessDefaults())
 * that run before every function. Compare base vs head with runtimeChanged() to catch setup edits
 * that don't change any imported file.
 */
export function indexSetupSource(source: string): string {
  const file = ts.createSourceFile('index.ts', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  return file.statements
    .filter((statement) => {
      if (ts.isExportDeclaration(statement) || ts.isExportAssignment(statement)) return false;
      const exported =
        ts.canHaveModifiers(statement) &&
        (ts.getModifiers(statement) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
      return !exported;
    })
    .map((statement) => statement.getText(file))
    .join('\n');
}

/** Exports whose source module or re-exported binding differs between two versions of index.ts. */
export function remappedExports(before: IIndexModules, after: IIndexModules): string[] {
  const moved: string[] = [];
  for (const [name, specifier] of after.reExports) {
    const previous = before.reExports.get(name);
    if (previous === undefined) continue;
    if (previous !== specifier || before.reExportBindings.get(name) !== after.reExportBindings.get(name)) moved.push(name);
  }
  return moved.sort();
}

// ---------------------------------------------------------------------------
// Bundle discovery (loads the built bundle in a child process)
// ---------------------------------------------------------------------------

export interface IDiscoveredExport {
  name: string;
  trigger: TriggerKind;
  eventType: string | null;
  secrets: string[];
  /** HTTPS functions' `invoker` option (e.g. ['private']); null when unset. Callables are always public. */
  invoker: string[] | null;
}

const DISCOVERY_MARKER = '__RELEASE_DISCOVERY__';

const discoveredSchema = z.array(
  z.object({
    name: z.string(),
    triggerKeys: z.array(z.string()),
    eventType: z.string().nullable(),
    secrets: z.array(z.string()),
    invoker: z.array(z.string()).nullable(),
  }),
);

const DISCOVERY_SCRIPT = `
const mod = require(process.argv[1]);
const out = [];
for (const [name, value] of Object.entries(mod)) {
  const endpoint = value && value.__endpoint;
  if (!endpoint) continue;
  out.push({
    name,
    triggerKeys: Object.keys(endpoint).filter((key) => key.endsWith('Trigger')),
    eventType: (endpoint.eventTrigger && endpoint.eventTrigger.eventType) || null,
    secrets: (endpoint.secretEnvironmentVariables || []).map((secret) => secret.key),
    invoker: (endpoint.httpsTrigger && endpoint.httpsTrigger.invoker) || null,
  });
}
process.stdout.write('\\n${DISCOVERY_MARKER}' + JSON.stringify(out) + '\\n');
`;

function triggerKind(keys: string[]): TriggerKind {
  if (keys.includes('callableTrigger')) return 'callable';
  if (keys.includes('httpsTrigger')) return 'https';
  if (keys.includes('taskQueueTrigger')) return 'taskQueue';
  if (keys.includes('scheduleTrigger')) return 'schedule';
  if (keys.includes('eventTrigger') || keys.includes('blockingTrigger')) return 'event';
  return 'unknown';
}

/** Requires a fresh `nx run functions:build` and installed functions/node_modules. */
export function discoverExports(): IDiscoveredExport[] {
  const bundle = resolve(FUNCTIONS_BUNDLE);
  if (!existsSync(bundle)) {
    throw new Error(`${FUNCTIONS_BUNDLE} not found — build functions first`);
  }
  const result = run('node', ['-e', DISCOVERY_SCRIPT, bundle], {
    cwd: resolve('functions'),
    env: {
      ...process.env,
      GCLOUD_PROJECT: PROJECT_ID,
      FUNCTIONS_CONTROL_API: 'true',
      FIREBASE_CONFIG: JSON.stringify({ projectId: PROJECT_ID }),
    },
  });
  const line = result.stdout.split('\n').find((candidate) => candidate.startsWith(DISCOVERY_MARKER));
  if (result.status !== 0 || !line) {
    throw new Error(`Could not load functions bundle for discovery:\n${result.stderr}`);
  }
  return discoveredSchema
    .parse(JSON.parse(line.slice(DISCOVERY_MARKER.length)))
    .map((entry) => ({
      name: entry.name,
      trigger: triggerKind(entry.triggerKeys),
      eventType: entry.eventType,
      secrets: [...new Set(entry.secrets)].sort(),
      invoker: entry.invoker,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Runtime equivalence: type-only / comment-only edits don't change what a function runs.
// ---------------------------------------------------------------------------

const TRANSPILED_EXTENSION = /\.(ts|tsx|mts|cts)$/;

async function transpile(source: string, path: string): Promise<string> {
  const result = await esbuild.transform(source, {
    loader: path.endsWith('.tsx') ? 'tsx' : 'ts',
    format: 'cjs',
    target: 'node22',
    legalComments: 'none',
    sourcefile: path,
  });
  return result.code;
}

/**
 * True when the compiled JavaScript of a file differs between two revisions (or the file was
 * added/removed). Non-TypeScript files are always treated as changed.
 */
export async function runtimeChanged(path: string, before: string | null, after: string | null): Promise<boolean> {
  if (before === null || after === null) return true;
  if (before === after) return false;
  if (!TRANSPILED_EXTENSION.test(path)) return true;
  try {
    const [a, b] = await Promise.all([transpile(before, path), transpile(after, path)]);
    return a !== b;
  } catch {
    return true; // can't prove equivalence → assume it changed
  }
}

// ---------------------------------------------------------------------------
// Import closures (esbuild metafile)
// ---------------------------------------------------------------------------

function resolveModuleFile(specifier: string): string {
  const base = join(FUNCTIONS_SRC, specifier);
  const candidates = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), `${base}.js`, base];
  const found = candidates.find((candidate) => existsSync(candidate) && !candidate.endsWith('/'));
  if (!found) throw new Error(`Cannot resolve functions module ${specifier}`);
  return found;
}

async function loadExternals(): Promise<string[]> {
  const loaded: unknown = await import(pathToFileURL(resolve('functions/esbuild.externals.mjs')).href);
  const parsed = z.object({ externalPackages: z.array(z.string()) }).parse(loaded);
  return parsed.externalPackages;
}

function localInputs(metafileInputs: Record<string, unknown>): Set<string> {
  return new Set(
    Object.keys(metafileInputs).filter((path) => !path.includes('node_modules/') && !path.startsWith('<')),
  );
}

export interface IClosures {
  modules: Map<string, Set<string>>;
  preamble: Set<string>;
}

export async function buildClosures(index: IIndexModules): Promise<IClosures> {
  const external = await loadExternals();
  const common: esbuild.BuildOptions = {
    absWorkingDir: process.cwd(),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    write: false,
    metafile: true,
    logLevel: 'silent',
    tsconfig: 'tsconfig.base.json',
    external,
  };

  const specifiers = [...new Set([...index.reExports.values(), ...index.starModules])];
  const entryPoints: Record<string, string> = {};
  specifiers.forEach((specifier, i) => {
    entryPoints[`m${i}`] = `./${resolveModuleFile(specifier)}`;
  });

  const modules = new Map<string, Set<string>>();
  if (specifiers.length > 0) {
    const result = await esbuild.build({ ...common, entryPoints, outdir: 'tmp/release-graph' });
    const outputs = result.metafile?.outputs ?? {};
    specifiers.forEach((specifier, i) => {
      const output = Object.entries(outputs).find(([path]) => path.endsWith(`/m${i}.js`));
      if (!output) throw new Error(`esbuild produced no output for ${specifier}`);
      modules.set(specifier, localInputs(output[1].inputs));
    });
  }

  const preambleResult = await esbuild.build({
    ...common,
    stdin: {
      contents: index.preambleImports.join('\n'),
      resolveDir: resolve(FUNCTIONS_SRC),
      sourcefile: '__release_preamble__.ts',
      loader: 'ts',
    },
    outfile: 'tmp/release-graph/preamble.js',
  });
  const preamble = localInputs(preambleResult.metafile?.inputs ?? {});

  return { modules, preamble };
}
