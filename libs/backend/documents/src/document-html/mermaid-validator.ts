import { MERMAID_DIAGRAM_PREFIXES } from '@shared-types';
import type { ValidationFinding } from './types';

const MERMAID_BLOCK_PATTERN =
  /<pre>\s*<code[^>]*class=["'][^"']*language-mermaid[^"']*["'][^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi;

const INVALID_MERMAID_LABEL_CHARS = /\[([^\]]*[/\\@][^\]]*)\]/;

/**
 * Detects Mermaid openers that appear as indented markdown (4+ spaces) outside
 * of <pre> blocks. `graph` / `flowchart` require a direction token so Python
 * like `graph = StateGraph(...)` does not false-positive.
 */
const INDENTED_MERMAID_OPENER_PATTERN =
  /(?:^|\n)\s{4,}(?:flowchart(?:\s+[A-Za-z]+)?|graph\s+[A-Za-z]+|sequenceDiagram|classDiagram|erDiagram|stateDiagram(?:-v2)?)\b/m;

const PRE_BLOCK_PATTERN = /<pre\b[^>]*>[\s\S]*?<\/pre>/gi;

export function extractMermaidBlocks(htmlFragment: string): string[] {
  const blocks: string[] = [];
  for (const match of htmlFragment.matchAll(MERMAID_BLOCK_PATTERN)) {
    if (match[1]?.trim()) {
      blocks.push(match[1].trim());
    }
  }
  return blocks;
}

function stripPreBlocks(htmlFragment: string): string {
  return htmlFragment.replace(PRE_BLOCK_PATTERN, '');
}

export function validateMermaidBlocks(htmlFragment: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const blocks = extractMermaidBlocks(htmlFragment);

  for (const [index, block] of blocks.entries()) {
    const firstLine = block.split('\n').find((line) => line.trim().length > 0)?.trim() ?? '';
    const normalized = firstLine.replace(/\s+/g, ' ');
    const isSupported = MERMAID_DIAGRAM_PREFIXES.some((prefix) =>
      normalized.toLowerCase().startsWith(prefix.toLowerCase())
    );

    if (!isSupported) {
      findings.push({
        severity: 'error',
        code: 'MERMAID_UNSUPPORTED_TYPE',
        category: 'mermaid',
        message: `Mermaid block ${index + 1} must start with a supported diagram type`,
        pathOrSnippet: firstLine || `block ${index + 1}`,
        repairHint: `Use one of: ${MERMAID_DIAGRAM_PREFIXES.join(', ')}.`,
      });
    }

    if (INVALID_MERMAID_LABEL_CHARS.test(block)) {
      findings.push({
        severity: 'error',
        code: 'MERMAID_INVALID_LABEL',
        category: 'mermaid',
        message: `Mermaid block ${index + 1} contains invalid characters in node labels`,
        pathOrSnippet: `block ${index + 1}`,
        repairHint: 'Avoid bare /, \\, or @ inside square-bracket node labels.',
      });
    }
  }

  const htmlOutsidePre = stripPreBlocks(htmlFragment);
  if (
    INDENTED_MERMAID_OPENER_PATTERN.test(htmlOutsidePre) &&
    blocks.length === 0
  ) {
    findings.push({
      severity: 'error',
      code: 'MERMAID_INDENTED_BLOCK',
      category: 'mermaid',
      message: 'Mermaid diagrams must use <pre><code class="language-mermaid"> blocks',
      repairHint: 'Wrap Mermaid source in a language-mermaid code block.',
    });
  }

  return findings;
}
