import {
  extractLineFormatSampleLine,
  lineMatchesSampleShape,
  rulesTextRequiresLineFormatOutput,
} from '@shared-types';
import type { DocumentRule, ValidationFinding } from './types';

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, '').trim();
}

function extractPreBlocks(html: string): string[] {
  const blocks: string[] = [];
  const pattern = /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi;
  let match = pattern.exec(html);
  while (match) {
    blocks.push(match[1]);
    match = pattern.exec(html);
  }
  return blocks;
}

function preInnerText(preHtml: string): string {
  return stripHtmlTags(preHtml.replace(/<code\b[^>]*>/gi, '').replace(/<\/code>/gi, ''));
}

function htmlOutsidePreBlocks(html: string): string {
  return stripHtmlTags(html.replace(/<pre\b[\s\S]*?<\/pre>/gi, ''));
}

function resolveLineFormatSampleLine(rules: DocumentRule[]): string | null {
  for (const rule of rules) {
    const sample = extractLineFormatSampleLine(rule.content);
    if (sample) {
      return sample;
    }
  }
  return null;
}

export function appliedRulesRequireLineFormatOutput(
  rules: DocumentRule[],
): boolean {
  return rules.some((rule) => rulesTextRequiresLineFormatOutput(rule.content));
}

export function validateLineFormatOutput(
  htmlFragment: string,
  rules: DocumentRule[] = [],
): ValidationFinding[] {
  if (!appliedRulesRequireLineFormatOutput(rules)) {
    return [];
  }

  const sampleLine = resolveLineFormatSampleLine(rules);
  if (!sampleLine) {
    return [];
  }

  const findings: ValidationFinding[] = [];
  const preBlocks = extractPreBlocks(htmlFragment);

  if (preBlocks.length !== 1) {
    findings.push({
      severity: 'error',
      code: 'LINE_FORMAT_SINGLE_PRE',
      category: 'rules',
      message:
        'Line-format rules require exactly one <pre> block in the HTML fragment',
      repairHint:
        'Remove headings, commentary, and extra sections. Put every transformed line inside a single <pre> block.',
    });
  }

  const outsideText = htmlOutsidePreBlocks(htmlFragment);
  if (outsideText.length > 0) {
    findings.push({
      severity: 'error',
      code: 'LINE_FORMAT_NO_EXTRA_SECTIONS',
      category: 'rules',
      message:
        'Line-format rules forbid titles, commentary, headings, or other sections outside the <pre> block',
      pathOrSnippet: outsideText.slice(0, 120),
      repairHint:
        'Delete all content outside the single <pre> block, including headings and explanatory paragraphs.',
    });
  }

  if (preBlocks.length === 1) {
    const lines = preInnerText(preBlocks[0])
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      findings.push({
        severity: 'error',
        code: 'LINE_FORMAT_EMPTY_PRE',
        category: 'rules',
        message: 'Line-format output must contain at least one transformed line',
      });
    }

    for (const [index, line] of lines.entries()) {
      if (!lineMatchesSampleShape(line, sampleLine)) {
        findings.push({
          severity: 'error',
          code: 'LINE_FORMAT_SHAPE_MISMATCH',
          category: 'rules',
          message: `Line ${index + 1} does not match the line-format sample shape`,
          pathOrSnippet: line.slice(0, 120),
          repairHint: `Each line must follow the sample shape: ${sampleLine}`,
        });
      }
    }
  }

  return findings;
}
