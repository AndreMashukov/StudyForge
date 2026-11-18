import { spawnSync, type SpawnSyncOptions } from 'node:child_process';

export interface IRunResult {
  status: number;
  stdout: string;
  stderr: string;
}

/** Run a command without a shell (arguments are never interpolated). */
export function run(command: string, args: string[], options: SpawnSyncOptions = {}): IRunResult {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  return {
    status: result.status ?? 1,
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
  };
}

/** Run and throw with stderr when the command fails. */
export function runOrThrow(command: string, args: string[], options: SpawnSyncOptions = {}): string {
  const result = run(command, args, options);
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status}):\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

export function readArg(name: string): string | null {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  const next = index >= 0 ? process.argv[index + 1] : undefined;
  return next && !next.startsWith('--') ? next : null;
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export function requireArg(name: string): string {
  const value = readArg(name);
  if (!value) throw new Error(`Missing required --${name}`);
  return value;
}
