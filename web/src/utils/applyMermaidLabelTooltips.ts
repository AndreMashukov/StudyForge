const MAX_VISIBLE_LABEL_CHARS = 28;

export interface IMermaidLabelTooltipsResult {
  source: string;
  nodeTooltips: Record<string, string>;
}

function detectDiagramType(source: string): string | null {
  const firstLine = source
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('%%'));
  if (!firstLine) {
    return null;
  }
  const match = firstLine.match(/^([A-Za-z_][\w]*)/);
  return match?.[1]?.toLowerCase() ?? null;
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

function shouldSkipLine(trimmedLine: string): boolean {
  return /^(click|style|classDef|class|linkStyle|subgraph|end|flowchart|graph|sequenceDiagram|classDiagram|erDiagram|participant|actor|%%)/i.test(
    trimmedLine
  );
}

function stripHashClickDirectives(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/^click\s+[A-Za-z_][\w]*\s+"#"/i.test(line.trim()))
    .join('\n');
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

function applyFlowchartLabelTooltips(source: string): IMermaidLabelTooltipsResult {
  const nodeTooltips: Record<string, string> = {};
  const lines = source.split('\n');

  const updatedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || shouldSkipLine(trimmed)) {
      return line;
    }

    let updated = line;
    for (const { pattern, delimiter } of FLOWCHART_NODE_PATTERNS) {
      updated = updated.replace(pattern, (match, nodeId: string, rawLabel: string) => {
        if (nodeTooltips[nodeId]) {
          return match;
        }

        const fullLabel = stripLabelQuotes(rawLabel);
        if (fullLabel.length <= MAX_VISIBLE_LABEL_CHARS) {
          return match;
        }

        const shortLabel = shortenLabel(fullLabel);
        nodeTooltips[nodeId] = fullLabel;
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

function applyClassDiagramLabelTooltips(source: string): IMermaidLabelTooltipsResult {
  const nodeTooltips: Record<string, string> = {};
  const lines = source.split('\n');

  const updatedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || shouldSkipLine(trimmed)) {
      return line;
    }

    return line.replace(/\bclass\s+([A-Za-z_][\w]*)\[([^\]\n]+)\]/g, (match, className: string, rawLabel: string) => {
      if (nodeTooltips[className]) {
        return match;
      }

      const fullLabel = stripLabelQuotes(rawLabel);
      if (fullLabel.length <= MAX_VISIBLE_LABEL_CHARS) {
        return match;
      }

      const shortLabel = shortenLabel(fullLabel);
      nodeTooltips[className] = fullLabel;
      return `class ${className}["${shortLabel.replace(/"/g, '#quot;')}"]`;
    });
  });

  return {
    source: updatedLines.join('\n'),
    nodeTooltips,
  };
}

/** Keep in sync with functions/src/services/mermaid/apply-mermaid-label-tooltips.ts */
export function applyMermaidLabelTooltips(source: string): IMermaidLabelTooltipsResult {
  const withoutHashClicks = stripHashClickDirectives(source);
  const diagramType = detectDiagramType(withoutHashClicks.trim());
  if (diagramType === 'flowchart' || diagramType === 'graph') {
    return applyFlowchartLabelTooltips(withoutHashClicks);
  }
  if (diagramType === 'classdiagram') {
    return applyClassDiagramLabelTooltips(withoutHashClicks);
  }
  return { source: withoutHashClicks, nodeTooltips: {} };
}
