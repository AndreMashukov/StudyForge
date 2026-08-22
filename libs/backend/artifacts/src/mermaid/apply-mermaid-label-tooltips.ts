import { extractDiagramType } from './supported-diagram-types';

const MAX_VISIBLE_LABEL_CHARS = 28;

export interface IMermaidLabelTooltipsResult {
  source: string;
  nodeTooltips: Record<string, string>;
}

function stripLabelQuotes(label: string): string {
  const trimmed = label.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function shortenLabel(text: string): string {
  if (text.length <= MAX_VISIBLE_LABEL_CHARS) {
    return text;
  }
  return `${text.slice(0, MAX_VISIBLE_LABEL_CHARS - 1).trimEnd()}…`;
}

/**
 * Decode Mermaid label encoding for human-readable tooltips/aria labels.
 * Mermaid renders `#91;` / `<br>` inside SVG nodes, but plain-text tooltips
 * must expand entity shorthand and break tags for display.
 */
export function decodeMermaidLabelForDisplay(label: string): string {
  return label
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/#quot;/g, '"')
    .replace(/#(\d+);/g, (_match, code: string) => {
      const charCode = Number.parseInt(code, 10);
      return Number.isFinite(charCode) ? String.fromCharCode(charCode) : _match;
    });
}

function shouldSkipLine(trimmedLine: string): boolean {
  return /^(click|style|classDef|class|linkStyle|subgraph|end|flowchart|graph|sequenceDiagram|classDiagram|erDiagram|participant|actor|%%)/i.test(
    trimmedLine
  );
}

interface IHashClickParseResult {
  nodeId: string;
  /** Complete tip text when present; null for truncated/empty tips. */
  tip: string | null;
}

function normalizeClickQuotes(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

function expandClickStatements(source: string): string[] {
  const expanded: string[] = [];
  for (const line of source.split('\n')) {
    const segments = line.split(/(?<=\S)(?=\s+click\s+)/i);
    if (segments.length === 1) {
      expanded.push(line);
      continue;
    }
    for (const segment of segments) {
      expanded.push(segment.trimEnd());
    }
  }
  return expanded;
}

/**
 * Match hash-click tooltip lines in double- or single-quoted form.
 * Truncated tips still match as hash-clicks so they can be dropped safely.
 * Any other `click` statement is also consumed so Mermaid never sees single quotes.
 */
function parseClickDirective(trimmedLine: string): IHashClickParseResult | null {
  const normalized = normalizeClickQuotes(trimmedLine.trim());
  const hashMatch = normalized.match(
    /^click\s+([A-Za-z_][\w]*)\s+(?:(["'])#\2|#)(.*)$/i
  );
  if (hashMatch) {
    const nodeId = hashMatch[1];
    const rest = hashMatch[3].trim();
    if (!rest) {
      return { nodeId, tip: null };
    }

    const tipMatch = rest.match(
      /^(["'])(.*?)\1(?:\s+(_blank|_self|_parent|_top))?\s*$/i
    );
    if (!tipMatch) {
      return { nodeId, tip: null };
    }

    const tip = tipMatch[2].trim();
    if (!tip) {
      return { nodeId, tip: null };
    }

    return { nodeId, tip };
  }

  const clickMatch = normalized.match(/^click\s+([A-Za-z_][\w]*)\b/i);
  if (!clickMatch) {
    return null;
  }

  return { nodeId: clickMatch[1], tip: null };
}

function isClickDirective(trimmedLine: string): boolean {
  return parseClickDirective(trimmedLine) !== null;
}

/**
 * Pull tip text out of hash-click lines, then remove those lines so Mermaid
 * never sees single-quoted or truncated click syntax.
 */
function extractHashClickTooltips(source: string): {
  sourceWithoutClicks: string;
  clickTooltips: Record<string, string>;
} {
  const clickTooltips: Record<string, string> = {};
  const keptLines: string[] = [];

  for (const line of expandClickStatements(source)) {
    const parsed = parseClickDirective(line.trim());
    if (!parsed) {
      keptLines.push(line);
      continue;
    }

    if (parsed.tip && !clickTooltips[parsed.nodeId]) {
      clickTooltips[parsed.nodeId] = decodeMermaidLabelForDisplay(parsed.tip);
    }
  }

  return {
    sourceWithoutClicks: keptLines.join('\n'),
    clickTooltips,
  };
}

function formatHashClickDirective(nodeId: string, tip: string): string {
  const escaped = tip
    .replace(/\r?\n/g, ' ')
    .replace(/"/g, '#quot;')
    .replace(/'/g, '');
  return `click ${nodeId} "#" "${escaped}"`;
}

/**
 * Persist tooltips as well-formed double-quoted hash-click lines so sanitized
 * diagram source keeps hover text after generation gates rewrite drafts.
 */
function appendHashClickDirectives(
  source: string,
  nodeTooltips: Record<string, string>
): string {
  const entries = Object.entries(nodeTooltips);
  if (entries.length === 0) {
    return source;
  }

  const withoutExistingClicks = source
    .split('\n')
    .filter((line) => !isClickDirective(line.trim()))
    .join('\n')
    .replace(/\s+$/, '');

  const clickLines = entries.map(([nodeId, tip]) =>
    formatHashClickDirective(nodeId, tip)
  );

  return `${withoutExistingClicks}\n${clickLines.join('\n')}`;
}

type NodeDelimiter = 'bracket' | 'paren' | 'brace';

const FLOWCHART_NODE_PATTERNS: { pattern: RegExp; delimiter: NodeDelimiter }[] = [
  { pattern: /\b([A-Za-z_][\w]*)\[([^\]\n]+)\]/g, delimiter: 'bracket' },
  { pattern: /\b([A-Za-z_][\w]*)\(([^)\n]+)\)/g, delimiter: 'paren' },
  { pattern: /\b([A-Za-z_][\w]*)\{([^}\n]+)\}/g, delimiter: 'brace' },
];

function formatShortNodeLabel(
  nodeId: string,
  shortLabel: string,
  delimiter: NodeDelimiter
): string {
  const escaped = shortLabel.replace(/"/g, '#quot;');
  switch (delimiter) {
    case 'bracket':
      return `${nodeId}["${escaped}"]`;
    case 'paren':
      return `${nodeId}("${escaped}")`;
    case 'brace':
      return `${nodeId}{"${escaped}"}`;
  }
}

function applyFlowchartLabelTooltips(
  source: string,
  initialTooltips: Record<string, string>
): IMermaidLabelTooltipsResult {
  const nodeTooltips: Record<string, string> = { ...initialTooltips };
  const lines = source.split('\n');

  const updatedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || shouldSkipLine(trimmed)) {
      return line;
    }

    let updated = line;
    for (const { pattern, delimiter } of FLOWCHART_NODE_PATTERNS) {
      updated = updated.replace(pattern, (match, nodeId: string, rawLabel: string) => {
        const fullLabel = stripLabelQuotes(rawLabel);
        if (fullLabel.length <= MAX_VISIBLE_LABEL_CHARS) {
          return match;
        }

        const shortLabel = shortenLabel(fullLabel);
        if (!nodeTooltips[nodeId]) {
          nodeTooltips[nodeId] = decodeMermaidLabelForDisplay(fullLabel);
        }
        return formatShortNodeLabel(nodeId, shortLabel, delimiter);
      });
    }

    return updated;
  });

  return {
    source: updatedLines.join('\n'),
    nodeTooltips,
  };
}

function applyClassDiagramLabelTooltips(
  source: string,
  initialTooltips: Record<string, string>
): IMermaidLabelTooltipsResult {
  const nodeTooltips: Record<string, string> = { ...initialTooltips };
  const lines = source.split('\n');

  const updatedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || shouldSkipLine(trimmed)) {
      return line;
    }

    return line.replace(
      /\bclass\s+([A-Za-z_][\w]*)\[([^\]\n]+)\]/g,
      (match, className: string, rawLabel: string) => {
        const fullLabel = stripLabelQuotes(rawLabel);
        if (fullLabel.length <= MAX_VISIBLE_LABEL_CHARS) {
          return match;
        }

        const shortLabel = shortenLabel(fullLabel);
        if (!nodeTooltips[className]) {
          nodeTooltips[className] = decodeMermaidLabelForDisplay(fullLabel);
        }
        return `class ${className}["${shortLabel.replace(/"/g, '#quot;')}"]`;
      }
    );
  });

  return {
    source: updatedLines.join('\n'),
    nodeTooltips,
  };
}

/**
 * Shortens long node/class labels and records full-label tooltips for SVG post-processing.
 * Harvests LLM hash-click tips (including invalid single-quoted forms), then rewrites
 * them as parse-safe `click id "#" "tip"` lines so sanitized storage keeps hover text.
 * Supported for flowchart/graph and classDiagram sources.
 */
export function applyMermaidLabelTooltips(source: string): IMermaidLabelTooltipsResult {
  const { sourceWithoutClicks, clickTooltips } = extractHashClickTooltips(source);
  const diagramType = extractDiagramType(sourceWithoutClicks.trim());

  let result: IMermaidLabelTooltipsResult;
  if (diagramType === 'flowchart' || diagramType === 'graph') {
    result = applyFlowchartLabelTooltips(sourceWithoutClicks, clickTooltips);
  } else if (diagramType === 'classdiagram') {
    result = applyClassDiagramLabelTooltips(sourceWithoutClicks, clickTooltips);
  } else {
    result = { source: sourceWithoutClicks, nodeTooltips: {} };
  }

  return {
    source: appendHashClickDirectives(result.source, result.nodeTooltips),
    nodeTooltips: result.nodeTooltips,
  };
}
