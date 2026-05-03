import { spawnSync } from 'node:child_process';

const DEFAULT_PROJECT = 'study-forge-202604';

interface IDeployOptions {
  functions: string[];
  project: string;
  printOnly: boolean;
}

function readOption(name: string): string | null {
  const prefix = `--${name}=`;
  const inlineArg = process.argv.find((arg) => arg.startsWith(prefix));
  if (inlineArg) {
    return inlineArg.slice(prefix.length).trim();
  }

  const optionIndex = process.argv.indexOf(`--${name}`);
  const value = optionIndex >= 0 ? process.argv[optionIndex + 1] : undefined;
  return value?.trim() || null;
}

function readBooleanOption(name: string): boolean {
  return process.argv.includes(`--${name}`) || readOption(name) === 'true';
}

function normalizeFunctionName(name: string): string {
  const trimmed = name.trim();
  return trimmed.startsWith('functions:') ? trimmed : `functions:${trimmed}`;
}

function readDeployOptions(): IDeployOptions {
  const rawFunctions = readOption('functions');
  const functions = rawFunctions
    ?.split(',')
    .map(normalizeFunctionName)
    .filter((name) => name !== 'functions:') ?? [];

  if (functions.length === 0) {
    throw new Error(
      'Provide at least one function: nx run functions:deploy-selected --functions=createApiKey,listApiKeys'
    );
  }

  return {
    functions,
    project: readOption('firebase-project') || readOption('firebaseProject') || readOption('project') || DEFAULT_PROJECT,
    printOnly: readBooleanOption('print-only') || readBooleanOption('printOnly'),
  };
}

const { functions, project, printOnly } = readDeployOptions();
const firebaseArgs = [
  'deploy',
  '--only',
  functions.join(','),
  '--project',
  project,
];

if (printOnly) {
  console.log(['./node_modules/.bin/firebase', ...firebaseArgs].join(' '));
  process.exit(0);
}

const result = spawnSync('./node_modules/.bin/firebase', firebaseArgs, {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
