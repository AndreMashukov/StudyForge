import { extractDiagramType } from './supported-diagram-types';

const MAX_VISIBLE_LABEL_CHARS = 28;

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

function escapeTooltipText(text: string): string {
  return text.replace(/"/g, '#quot;');
}

function collectExistingClickNodes(lines: string[]): Set<string> {
  const nodes = new Set<string>();
  for (const line of lines) {
    const match = line.trim().match(/^click\s+([A-Za-z_][\w]*)\b/i);
    if (match) {
      nodes.add(match[1]);
    }
  }
  return nodes;
}

function shouldSkipLine(trimmedLine: string): boolean {
  return /^(click|style|classDef|class|linkStyle|subgraph|end|flowchart|graph|sequenceDiagram|classDiagram|erDiagram|participant|actor|%%)/i.test(
    trimmedLine
  );
}

const FLOWCHART_NODE_PATTERNS: RegExp[] = [
  /\b([A-Za-z_][\w]*)\[([^\]\n]+)\]/g,
  /\b([A-Za-z_][\w]*)\(([^)\n]+)\)/g,
  /\b([A-Za-z_][\w]*)\{([^}\n]+)\}/g,
];

function applyFlowchartLabelTooltips(source: string): string {
  const lines = source.split('\n');
  const existingClickNodes = collectExistingClickNodes(lines);
  const clickLines: string[] = [];

  const updatedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || shouldSkipLine(trimmed)) {
      return line;
    }

    let updated = line;
    for (const pattern of FLOWCHART_NODE_PATTERNS) {
      updated = updated.replace(pattern, (match, nodeId: string, rawLabel: string) => {
        if (existingClickNodes.has(nodeId)) {
          return match;
        }

        const fullLabel = stripLabelQuotes(rawLabel);
        if (fullLabel.length <= MAX_VISIBLE_LABEL_CHARS) {
          return match;
        }

        const shortLabel = shortenLabel(fullLabel);
        clickLines.push(`click ${nodeId} "#" "${escapeTooltipText(fullLabel)}"`);
        existingClickNodes.add(nodeId);
        return `${nodeId}["${shortLabel.replace(/"/g, '#quot;')}"]`;
      });
    }

    return updated;
  });

  if (clickLines.length === 0) {
    return source;
  }

  const result: string[] = [];
  let clickLinesInserted = false;
  for (const line of updatedLines) {
    if (!clickLinesInserted && /^(style|classDef|class)\s/i.test(line.trim())) {
      result.push(...clickLines);
      clickLinesInserted = true;
    }
    result.push(line);
  }

  if (!clickLinesInserted) {
    result.push(...clickLines);
  }

  return result.join('\n');
}

function applyClassDiagramLabelTooltips(source: string): string {
  const lines = source.split('\n');
  const existingClickNodes = collectExistingClickNodes(lines);
  const clickLines: string[] = [];

  const updatedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || shouldSkipLine(trimmed)) {
      return line;
    }

    return line.replace(/\bclass\s+([A-Za-z_][\w]*)\[([^\]\n]+)\]/g, (match, className: string, rawLabel: string) => {
      if (existingClickNodes.has(className)) {
        return match;
      }

      const fullLabel = stripLabelQuotes(rawLabel);
      if (fullLabel.length <= MAX_VISIBLE_LABEL_CHARS) {
        return match;
      }

      const shortLabel = shortenLabel(fullLabel);
      clickLines.push(`click ${className} "#" "${escapeTooltipText(fullLabel)}"`);
      existingClickNodes.add(className);
      return `class ${className}["${shortLabel.replace(/"/g, '#quot;')}"]`;
    });
  });

  if (clickLines.length === 0) {
    return source;
  }

  return [...updatedLines, ...clickLines].join('\n');
}

/**
 * Shortens long node/class labels and adds Mermaid hover tooltips via click directives.
 * Supported for flowchart/graph and classDiagram sources.
 */
export function applyMermaidLabelTooltips(source: string): string {
  const diagramType = extractDiagramType(source.trim());
  if (diagramType === 'flowchart' || diagramType === 'graph') {
    return applyFlowchartLabelTooltips(source);
  }
  if (diagramType === 'classDiagram') {
    return applyClassDiagramLabelTooltips(source);
  }
  return source;
}
