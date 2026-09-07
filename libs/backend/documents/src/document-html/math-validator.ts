import type { DocumentRule, ValidationFinding } from './types';

const MATH_RULE_NAMES = new Set([
  'math study document formatting',
  'web math formula rendering',
]);

const MATH_RULE_TAGS = new Set(['latex', 'katex']);

const MATH_RULE_CONTENT_SIGNAL =
  /katex-ready|katex\b|\$\.\.\.\$|\\\(\.\.\.\\\)|web math formula rendering|math study document formatting/i;

const UNICODE_MATH_CODE_POINTS: readonly number[] = [
  0x2070, 0x00b9, 0x00b2, 0x00b3, 0x2074, 0x2075, 0x2076, 0x2077, 0x2078,
  0x2079, 0x207a, 0x207b, 0x207c, 0x207d, 0x207e, 0x207f, 0x2071, 0x1d43,
  0x1d47, 0x1d9c, 0x1d48, 0x1d49, 0x1da0, 0x1d4d, 0x02b0, 0x02b2, 0x1d4f,
  0x02e1, 0x1d50, 0x1d52, 0x1d56, 0x02b3, 0x02e2, 0x1d57, 0x1d58, 0x1d5b,
  0x02b7, 0x02e3, 0x02b8, 0x1dbb, 0x2080, 0x2081, 0x2082, 0x2083, 0x2084,
  0x2085, 0x2086, 0x2087, 0x2088, 0x2089, 0x208a, 0x208b, 0x208c, 0x208d,
  0x208e, 0x2090, 0x2091, 0x2095, 0x1d62, 0x2c7c, 0x2096, 0x2097, 0x2098,
  0x2099, 0x2092, 0x209a, 0x1d63, 0x209b, 0x209c, 0x2093, 0x1d67, 0x03b1,
  0x03b2, 0x03b3, 0x03b4, 0x03b5, 0x03b7, 0x03b8, 0x03bb, 0x03bc, 0x03c0,
  0x03c3, 0x03c4, 0x03c6, 0x03c9, 0x03a3, 0x03a0, 0x03a9, 0x2211, 0x222b,
  0x221a, 0x2208, 0x221e, 0x2248, 0x2260, 0x2264, 0x2265, 0x2202, 0x2207,
  0x211d, 0x2124, 0x2115, 0x2102, 0x0177, 0x2299,
];

const UNDELIMITED_MATH_SYMBOLS = new RegExp(
  `[${UNICODE_MATH_CODE_POINTS.map((code) => `\\u{${code.toString(16)}}`).join('')}]`,
  'u',
);

export function ruleRequiresKatexDelimiters(rule: DocumentRule): boolean {
  const tags = rule.tags ?? [];
  if (tags.some((tag) => MATH_RULE_TAGS.has(tag.toLowerCase()))) {
    return true;
  }

  if (MATH_RULE_NAMES.has(rule.name.trim().toLowerCase())) {
    return true;
  }

  return MATH_RULE_CONTENT_SIGNAL.test(`${rule.name}\n${rule.content}`);
}

export function appliedRulesRequireKatexDelimiters(
  rules: DocumentRule[],
): boolean {
  return rules.some(ruleRequiresKatexDelimiters);
}

const PRE_CODE_BLOCK_PATTERN =
  /<pre[^>]*>\s*<code([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi;

const PROGRAMMING_LANGUAGES = new Set([
  'python',
  'javascript',
  'typescript',
  'js',
  'ts',
  'bash',
  'sh',
  'shell',
  'sql',
  'json',
  'html',
  'css',
  'rust',
  'go',
  'java',
  'c',
  'cpp',
  'c++',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'r',
  'matlab',
  'yaml',
  'xml',
  'plotly',
  'graph',
  'mermaid',
]);

const PROGRAMMING_MARKERS =
  /\b(import |from |def |class |function |const |let |var |return |print\(|#include|=>|\bfn )/i;

const EQUATION_MARKERS =
  /\b(tanh|softmax|sigmoid|relu|sin|cos|log|exp)\b|\([a-zA-Z]\w{0,3}\)|\s[·×÷]\s/iu;

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function readCodeLanguage(attributes: string): string {
  const match = /language-([a-z0-9+#.-]+)/i.exec(attributes);
  return match?.[1]?.toLowerCase() ?? '';
}

function looksLikeFormulaBlock(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed || PROGRAMMING_MARKERS.test(trimmed)) {
    return false;
  }

  const equationLines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.includes('=') &&
        (UNDELIMITED_MATH_SYMBOLS.test(line) || EQUATION_MARKERS.test(line)),
    );

  return equationLines.length > 0;
}

export function findFormulaCodeBlockSnippet(
  htmlFragment: string,
): string | undefined {
  for (const match of htmlFragment.matchAll(PRE_CODE_BLOCK_PATTERN)) {
    const language = readCodeLanguage(match[1] ?? '');
    if (PROGRAMMING_LANGUAGES.has(language)) {
      continue;
    }

    const content = decodeBasicEntities(match[2] ?? '');
    if (!looksLikeFormulaBlock(content)) {
      continue;
    }

    return content.replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  return undefined;
}

function stripIgnoredRegions(html: string): string {
  return html
    .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<code[\s\S]*?<\/code>/gi, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]+\$/g, ' ')
    .replace(/\\\[[\s\S]*?\\\]/g, ' ')
    .replace(/\\\([\s\S]*?\\\)/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}

export function findUndelimitedMathSnippet(
  htmlFragment: string,
): string | undefined {
  const searchable = stripIgnoredRegions(htmlFragment);
  const match = UNDELIMITED_MATH_SYMBOLS.exec(searchable);
  if (!match || match.index === undefined) {
    return undefined;
  }

  const start = Math.max(0, match.index - 12);
  return searchable
    .slice(start, match.index + 48)
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateMathDelimiters(
  htmlFragment: string,
  rules: DocumentRule[] = [],
): ValidationFinding[] {
  if (!appliedRulesRequireKatexDelimiters(rules)) {
    return [];
  }

  const findings: ValidationFinding[] = [];

  const unicodeSnippet = findUndelimitedMathSnippet(htmlFragment);
  if (unicodeSnippet) {
    findings.push({
      severity: 'error',
      code: 'MATH_UNDELIMITED_UNICODE',
      category: 'math',
      message:
        'Applied math rules require KaTeX delimiters; Unicode or plain-text formulas were found instead',
      pathOrSnippet: unicodeSnippet,
      repairHint:
        'Rewrite formulas with $...$ / $$...$$ or \\(...\\) / \\[...\\] in normal HTML text. Do not use Unicode subscripts, superscripts, or Greek letters outside those delimiters.',
    });
  }

  const codeBlockSnippet = findFormulaCodeBlockSnippet(htmlFragment);
  if (codeBlockSnippet) {
    findings.push({
      severity: 'error',
      code: 'MATH_FORMULA_IN_CODE_BLOCK',
      category: 'math',
      message:
        'Applied math rules require KaTeX delimiters in HTML text; formulas were placed in a code block',
      pathOrSnippet: codeBlockSnippet,
      repairHint:
        'Move equations out of <pre>/<code> into $...$ / $$...$$ or \\(...\\) / \\[...\\] in a paragraph. Keep <pre><code> for executable programs only (for example language-python).',
    });
  }

  return findings;
}
