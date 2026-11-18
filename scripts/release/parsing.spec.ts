import { describe, expect, it } from 'vitest';
import { parseIndexModules, remappedExports, runtimeChanged } from './function-graph';
import { extractJson } from './llm';
import { extractHeader, parsePhase } from './migrations';

describe('parseIndexModules', () => {
  const source = `
import './global-options';
import { applyLangSmithProcessDefaults } from '@study-forge/backend-core/services/langsmith-tracing';
import { onRequest } from 'firebase-functions/v2/https';

export const healthCheck = onRequest({}, async () => {});
export { generateQuiz } from './endpoints/quizzes';
export {
  createBillingCheckoutSessionEndpoint as createBillingCheckoutSession,
  stripeBillingWebhook,
} from './endpoints/billing';
export * from './endpoints/legacy';
`;

  it('maps re-exports (including aliases) to their module', () => {
    const parsed = parseIndexModules(source);
    expect(parsed.reExports.get('generateQuiz')).toBe('./endpoints/quizzes');
    expect(parsed.reExports.get('createBillingCheckoutSession')).toBe('./endpoints/billing');
    expect(parsed.reExports.get('stripeBillingWebhook')).toBe('./endpoints/billing');
    expect(parsed.reExports.has('createBillingCheckoutSessionEndpoint')).toBe(false);
  });

  it('collects inline exports, preamble imports and star modules', () => {
    const parsed = parseIndexModules(source);
    expect(parsed.inlineExports).toEqual(['healthCheck']);
    expect(parsed.preambleImports).toHaveLength(3);
    expect(parsed.starModules).toEqual(['./endpoints/legacy']);
  });

  it('detects an export that moved to another module', () => {
    const before = parseIndexModules(`export { a } from './x';\nexport { b } from './y';`);
    const after = parseIndexModules(`export { a } from './z';\nexport { b } from './y';\nexport { c } from './y';`);
    expect(remappedExports(before, after)).toEqual(['a']);
  });
});

describe('migration headers', () => {
  it('reads the phase tag from a block comment after a shebang', () => {
    const header = extractHeader('#!/usr/bin/env node\n/**\n * Backfill x.\n * @release-phase post-functions\n */\nimport x from "y";');
    expect(parsePhase(header)).toBe('post-functions');
  });

  it('reads line comments', () => {
    expect(parsePhase(extractHeader('// Migrate routes\n// @release-phase pre-functions\nconst a = 1;'))).toBe('pre-functions');
  });

  it('treats unknown or missing phases as untagged', () => {
    expect(parsePhase('/** @release-phase whenever */')).toBeNull();
    expect(parsePhase('/** no tag here */')).toBeNull();
    // A tag outside the header does not count.
    expect(parsePhase(extractHeader('/** header */\n// @release-phase pre-functions'))).toBeNull();
  });
});

describe('extractJson', () => {
  it('tolerates think tags and code fences', () => {
    expect(extractJson('<think>hmm {not json}</think>\n```json\n{"summary":"x"}\n```')).toEqual({ summary: 'x' });
  });

  it('throws when there is no object', () => {
    expect(() => extractJson('no plan today')).toThrow('no JSON object');
  });
});

describe('runtimeChanged', () => {
  it('ignores type-only and comment-only edits', async () => {
    const before = 'export interface A { x: number }\nexport const f = (a: A) => a.x;';
    const after = '/** doc */\nexport interface A { x: number; y?: string }\nexport interface B { z: boolean }\nexport const f = (a: A): number => a.x;';
    expect(await runtimeChanged('libs/x.ts', before, after)).toBe(false);
  });

  it('detects runtime edits, added files and non-TS files', async () => {
    expect(await runtimeChanged('libs/x.ts', 'export const f = 1;', 'export const f = 2;')).toBe(true);
    expect(await runtimeChanged('libs/x.ts', null, 'export const f = 1;')).toBe(true);
    expect(await runtimeChanged('libs/prompt.json', '{"a":1}', '{"a": 1}')).toBe(true);
  });
});
