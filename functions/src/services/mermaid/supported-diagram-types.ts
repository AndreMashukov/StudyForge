export const SUPPORTED_DIAGRAM_TYPES = new Set([
  'flowchart',
  'graph',
  'sequencediagram',
  'classdiagram',
  'erdiagram',
  'statediagram',
  'statediagramv2',
]);

export const BANNED_DIAGRAM_TYPES = new Set([
  'mindmap',
  'timeline',
  'gantt',
  'pie',
  'gitgraph',
  'journey',
  'sankey',
  'xychart',
  'block',
  'packet',
  'kanban',
  'architecture',
]);

export function extractDiagramType(source: string): string | null {
  const firstLine = source.split('\n').find((line) => line.trim().length > 0)?.trim() ?? '';
  const match = firstLine.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
  if (!match) {
    return null;
  }
  return match[1].toLowerCase().replace(/-/g, '');
}
