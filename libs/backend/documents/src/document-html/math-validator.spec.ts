import { describe, expect, it } from 'vitest';
import {
  appliedRulesRequireKatexDelimiters,
  validateMathDelimiters,
} from './math-validator';
import { validateDocumentHtml } from './index';
import type { DocumentRule } from './types';

const MATH_RULE: DocumentRule = {
  name: 'Math Study Document Formatting',
  content:
    'Use KaTeX-ready LaTeX. Emit formulas with `$...$` / `$$...$$` or `\\(...\\)` / `\\[...\\]`.',
  tags: ['document', 'math', 'latex', 'katex'],
};

const GENERIC_RULE: DocumentRule = {
  name: 'Doc HTML Format',
  content: 'Output strictly HTML content. Use headings and lists.',
  tags: ['document', 'html', 'format'],
};

const UNICODE_FORMULA = '<p><em>σ(z) = 1/(1 + e⁻ᶻ)</em></p>';
const DELIMITED_FORMULA = '<p>\\(\\sigma(z) = \\frac{1}{1 + e^{-z}}\\)</p>';
const MIXED_FORMULA =
  '<p>\\(\\sigma(z) = \\frac{1}{1 + e^{-z}}\\)</p><p><em>h⁽ᵗ⁾ = σ(Wₕₓx)</em></p>';

describe('math delimiter gate', () => {
  it('detects math rules by name, tags, or KaTeX instruction text', () => {
    expect(appliedRulesRequireKatexDelimiters([MATH_RULE])).toBe(true);
    expect(
      appliedRulesRequireKatexDelimiters([
        {
          name: 'Applied Rules',
          content:
            'RULE #1 - Math Study Document Formatting\nUse KaTeX-ready LaTeX with `$...$`.',
        },
      ]),
    ).toBe(true);
    expect(appliedRulesRequireKatexDelimiters([GENERIC_RULE])).toBe(false);
  });

  it('does not flag unicode formulas when no math rule is applied', () => {
    expect(validateMathDelimiters(UNICODE_FORMULA, [GENERIC_RULE])).toEqual([]);
    expect(validateMathDelimiters(UNICODE_FORMULA, [])).toEqual([]);
  });

  it('flags unicode formulas when a math rule is applied', () => {
    const findings = validateMathDelimiters(UNICODE_FORMULA, [MATH_RULE]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe('MATH_UNDELIMITED_UNICODE');
    expect(findings[0]?.pathOrSnippet).toContain('σ(z)');
  });

  it('accepts delimited KaTeX and ignores math symbols inside those delimiters', () => {
    expect(validateMathDelimiters(DELIMITED_FORMULA, [MATH_RULE])).toEqual([]);
    expect(
      validateMathDelimiters('<p>$\\sigma(z) = 1/(1+e^{-z})$</p>', [MATH_RULE]),
    ).toEqual([]);
  });

  it('still flags leftover unicode after a valid delimited formula', () => {
    const findings = validateMathDelimiters(MIXED_FORMULA, [MATH_RULE]);
    expect(findings[0]?.code).toBe('MATH_UNDELIMITED_UNICODE');
  });

  it('ignores unicode inside code samples', () => {
    const html =
      '<pre><code class="language-python">σ = 1</code></pre><p>No formula.</p>';
    expect(validateMathDelimiters(html, [MATH_RULE])).toEqual([]);
  });
});

describe('validateDocumentHtml math options', () => {
  it('fails html validation when a math rule is applied and formulas are undelimited', async () => {
    const report = await validateDocumentHtml(UNICODE_FORMULA, {
      rules: [MATH_RULE],
    });
    expect(report.passed).toBe(false);
    expect(
      report.findings.some(
        (finding) => finding.code === 'MATH_UNDELIMITED_UNICODE',
      ),
    ).toBe(true);
  });

  it('skips the math gate when requested', async () => {
    const report = await validateDocumentHtml(UNICODE_FORMULA, {
      rules: [MATH_RULE],
      skipMathGate: true,
    });
    expect(
      report.findings.some(
        (finding) => finding.code === 'MATH_UNDELIMITED_UNICODE',
      ),
    ).toBe(false);
  });

  it('does not change validation for docs without a math rule', async () => {
    const report = await validateDocumentHtml('<h1>Title</h1><p>Body text</p>');
    expect(report.passed).toBe(true);
  });
});
