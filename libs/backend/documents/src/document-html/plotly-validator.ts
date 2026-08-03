import { PLOTLY_ALLOWED_TRACE_TYPES } from '@shared-types';
import type { ValidationFinding } from './types';

const PLOTLY_BLOCK_PATTERN =
  /<pre>\s*<code[^>]*class=["'][^"']*language-(?:plotly|graph)[^"']*["'][^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi;

const ALLOWED_TYPE_SET = new Set<string>(PLOTLY_ALLOWED_TRACE_TYPES);

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export function extractPlotlyBlocks(htmlFragment: string): string[] {
  const blocks: string[] = [];
  for (const match of htmlFragment.matchAll(PLOTLY_BLOCK_PATTERN)) {
    if (match[1]?.trim()) {
      blocks.push(decodeBasicEntities(match[1]).trim());
    }
  }
  return blocks;
}

export function validatePlotlyBlocks(htmlFragment: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const blocks = extractPlotlyBlocks(htmlFragment);

  for (const [index, block] of blocks.entries()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch {
      findings.push({
        severity: 'error',
        code: 'PLOTLY_INVALID_JSON',
        category: 'plotly',
        message: `Plotly block ${index + 1} must be valid JSON`,
        pathOrSnippet: `block ${index + 1}`,
        repairHint: 'Emit a single JSON object with a data array inside language-plotly.',
      });
      continue;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      findings.push({
        severity: 'error',
        code: 'PLOTLY_INVALID_SHAPE',
        category: 'plotly',
        message: `Plotly block ${index + 1} must be a JSON object`,
        pathOrSnippet: `block ${index + 1}`,
        repairHint: 'Use {"data":[...],"layout":{...}} format.',
      });
      continue;
    }

    const figure = parsed as Record<string, unknown>;
    if (!Array.isArray(figure['data']) || figure['data'].length === 0) {
      findings.push({
        severity: 'error',
        code: 'PLOTLY_EMPTY_DATA',
        category: 'plotly',
        message: `Plotly block ${index + 1} requires a non-empty data array`,
        pathOrSnippet: `block ${index + 1}`,
        repairHint: 'Include at least one trace in data.',
      });
      continue;
    }

    for (const [traceIndex, trace] of figure['data'].entries()) {
      if (!trace || typeof trace !== 'object' || Array.isArray(trace)) {
        findings.push({
          severity: 'error',
          code: 'PLOTLY_INVALID_TRACE',
          category: 'plotly',
          message: `Plotly block ${index + 1} trace ${traceIndex + 1} must be an object`,
          pathOrSnippet: `block ${index + 1}`,
        });
        continue;
      }

      const type = (trace as Record<string, unknown>)['type'];
      if (typeof type !== 'string' || !ALLOWED_TYPE_SET.has(type)) {
        findings.push({
          severity: 'error',
          code: 'PLOTLY_UNSUPPORTED_TYPE',
          category: 'plotly',
          message: `Plotly block ${index + 1} trace ${traceIndex + 1} has unsupported type`,
          pathOrSnippet: typeof type === 'string' ? type : `block ${index + 1}`,
          repairHint: `Use one of: ${PLOTLY_ALLOWED_TRACE_TYPES.join(', ')}.`,
        });
      }
    }
  }

  return findings;
}
