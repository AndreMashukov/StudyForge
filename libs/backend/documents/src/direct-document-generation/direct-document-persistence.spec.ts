import { describe, expect, it } from 'vitest';
import { buildHtmlScreenshotDocumentPrompt, buildSealedHtmlOutputContract } from '@shared-types';
import { buildDirectHtmlPrompt } from './direct-document-prompt-builder';
import type { DocumentAgentContext } from '../document-agent/document-agent-runner';
import { normalizeGeneratedHtmlFragment, validateDocumentHtml } from '../document-html';

function createAgentContext(overrides?: Partial<DocumentAgentContext>): DocumentAgentContext {
  return {
    userId: 'user-1',
    directoryId: 'dir-1',
    documentId: 'doc-1',
    jobId: 'job-1',
    payload: { sourceKind: 'prompt', prompt: 'Explain LangGraph' },
    userPrompt: 'Explain LangGraph',
    rulesText: 'Use concise headings.',
    rules: [{ name: 'Applied Rules', content: 'Use concise headings.' }],
    appliedRuleIds: ['rule-1'],
    ...overrides,
  };
}

describe('direct document generation helpers', () => {
  it('buildDirectHtmlPrompt includes sealed HTML contract and rules', () => {
    const prompt = buildDirectHtmlPrompt(createAgentContext());
    expect(prompt).toContain('SEALED OUTPUT CONTRACT');
    expect(prompt).toContain('Explain LangGraph');
    expect(prompt).toContain('Use concise headings.');
  });

  it('buildDirectHtmlPrompt appends reference documents when files are present', () => {
    const prompt = buildDirectHtmlPrompt(
      createAgentContext({
        files: [{ filename: 'notes.md', content: 'Reference notes', size: 100 }],
      })
    );
    expect(prompt).toContain('REFERENCE DOCUMENTS');
    expect(prompt).toContain('notes.md');
  });

  it('buildHtmlScreenshotDocumentPrompt uses HTML contract', () => {
    const prompt = buildHtmlScreenshotDocumentPrompt({
      userPrompt: 'Extract the table',
      rules: 'Keep glossary as a table.',
    });
    expect(prompt).toContain(buildSealedHtmlOutputContract());
    expect(prompt).toContain('Extract the table');
  });

  it('strips trailing whitespace before direct validation passes', async () => {
    const withTrailing = '<h1>Title</h1>  \n<p>Body</p>\t\n';
    const normalized = normalizeGeneratedHtmlFragment(withTrailing);
    const report = await validateDocumentHtml(normalized);
    expect(report.passed).toBe(true);
  });
});
