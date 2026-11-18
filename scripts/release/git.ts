import { DIFF_EXCLUDE, DIFF_MAX_CHARS_PER_FILE, DIFF_MAX_CHARS_TOTAL } from './config';
import { run, runOrThrow } from './exec';

/** Files changed between two commits. Renames are reported as delete + add so both paths are seen. */
export function changedFiles(base: string, head: string): string[] {
  return runOrThrow('git', ['diff', '--name-only', '--no-renames', `${base}...${head}`])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

/** File contents at a revision, or null when the file does not exist there. */
export function fileAt(rev: string, path: string): string | null {
  const result = run('git', ['show', `${rev}:${path}`]);
  return result.status === 0 ? result.stdout : null;
}

export interface IDiffExcerpt {
  text: string;
  truncatedFiles: string[];
  omittedFiles: string[];
}

/** A bounded unified diff for the LLM. Excluded and over-budget files are listed, not silently dropped. */
export function diffExcerpt(base: string, head: string, files: string[]): IDiffExcerpt {
  const truncatedFiles: string[] = [];
  const omittedFiles: string[] = [];
  const parts: string[] = [];
  let total = 0;

  for (const file of files) {
    if (DIFF_EXCLUDE.some((pattern) => pattern.test(file))) {
      omittedFiles.push(file);
      continue;
    }
    let patch = run('git', ['diff', '--no-renames', '--unified=3', `${base}...${head}`, '--', file]).stdout;
    if (patch.length > DIFF_MAX_CHARS_PER_FILE) {
      patch = `${patch.slice(0, DIFF_MAX_CHARS_PER_FILE)}\n… [truncated ${patch.length - DIFF_MAX_CHARS_PER_FILE} chars]\n`;
      truncatedFiles.push(file);
    }
    if (total + patch.length > DIFF_MAX_CHARS_TOTAL) {
      omittedFiles.push(file);
      continue;
    }
    total += patch.length;
    parts.push(patch);
  }

  return { text: parts.join('\n'), truncatedFiles, omittedFiles };
}
