import { describe, expect, it } from 'vitest';
import {
  extractBodyHtml,
  extractHtmlTitle,
  htmlToReadableText,
  wrapHtmlDocument,
} from './html-utils';
import { normalizeGeneratedHtmlFragment } from './normalize-html';
import { prepareHtmlDocumentForStorage, validateDocumentHtml } from './index';
import { validateNonEmpty, validateSecurity } from './security-validator';

describe('document-html utils', () => {
  it('wraps and extracts body html', () => {
    const wrapped = wrapHtmlDocument('<h1>Title</h1><p>Body</p>', 'Title');
    expect(extractBodyHtml(wrapped)).toContain('<h1>Title</h1>');
    expect(extractHtmlTitle(wrapped)).toBe('Title');
  });

  it('normalizes fenced html fragments', () => {
    const normalized = normalizeGeneratedHtmlFragment('```html\n<p>Hello</p>\n```');
    expect(normalized).toBe('<p>Hello</p>');
  });

  it('strips trailing whitespace so validation does not fail on cosmetic LLM output', async () => {
    const withTrailing = '<h1>Title</h1>  \n<p>Body</p>\t\n';
    const normalized = normalizeGeneratedHtmlFragment(withTrailing);
    expect(normalized).toBe('<h1>Title</h1>\n<p>Body</p>');

    const report = await validateDocumentHtml(withTrailing);
    expect(report.passed).toBe(true);
    expect(
      report.findings.some((finding) => finding.code === 'HTML_no-trailing-whitespace')
    ).toBe(false);
  });

  it('converts html to readable text', () => {
    const text = htmlToReadableText('<h1>Heading</h1><p>Paragraph</p>');
    expect(text).toContain('Heading');
    expect(text).toContain('Paragraph');
  });

  it('rejects wrapper tags in security validation', () => {
    const findings = validateSecurity('<html><body><p>Hi</p></body></html>');
    expect(findings.some((finding) => finding.code === 'FORMAT_WRAPPER_TAG')).toBe(true);
  });

  it('flags empty fragments', () => {
    expect(validateNonEmpty('   ').length).toBeGreaterThan(0);
  });

  it('prepares valid html for storage', async () => {
    const prepared = await prepareHtmlDocumentForStorage(
      '<h1>Title</h1><p>Body text</p>',
      'Title'
    );
    expect(prepared.fullHtml).toContain('<title>Title</title>');
    expect(prepared.wordCount).toBeGreaterThan(0);
    const report = await validateDocumentHtml(extractBodyHtml(prepared.fullHtml));
    expect(report.passed).toBe(true);
  });
});
