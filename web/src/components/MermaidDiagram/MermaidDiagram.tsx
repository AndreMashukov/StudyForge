import React, { useEffect, useId, useState } from 'react';
import mermaid from 'mermaid';
import { cn } from '../../lib/utils';
import { IMermaidDiagram } from './IMermaidDiagram';
import { Spinner } from '../ui/Spinner';

let mermaidInitialized = false;

function ensureMermaidInit(): void {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'dark',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  });
  mermaidInitialized = true;
}

/**
 * Mermaid reserves certain characters inside square-bracket node labels:
 *   /  \ — trigger trapezoid shape syntax
 *   @    — parsed as a link ID token
 *   ( )  — parsed as sub-graph / stadium shape tokens
 * When AI-generated diagrams use these bare in labels the lexer/parser throws.
 * Wrap any affected label content in double-quotes so Mermaid treats it as a
 * plain string, e.g. [dfs(A)] -> ["dfs(A)"], [/usage] -> ["/usage"].
 */
function sanitizeBracketLabels(source: string): string {
  return source.replace(
    /\[([^\]"]*[/@\\()][^\]"]*)\]/g,
    (_match, inner: string) => `["${inner}"]`
  );
}

/**
 * Round-paren node labels like  ('label')  or  ("label")  break when the
 * inner text itself contains parentheses — the Mermaid lexer treats an inner
 * '(' as a new shape-start token (PS).  Example:
 *   F0('Function 0 (Running)')   ← parse error
 *   F0('Function 0 #40;Running#41;')  ← works
 *
 * Replace inner parentheses with Mermaid HTML-entity shorthand #40; and #41;.
 */
function sanitizeParenLabels(source: string): string {
  // Single-quoted paren labels: ('...')
  let result = source.replace(/\('([^'\n]*)'\)/g, (_match, inner: string) => {
    if (!/[()]/.test(inner)) return _match;
    const escaped = inner.replace(/\(/g, '#40;').replace(/\)/g, '#41;');
    return `('${escaped}')`;
  });
  // Double-quoted paren labels: ("...")
  result = result.replace(/\("([^"\n]*)"\)/g, (_match, inner: string) => {
    if (!/[()]/.test(inner)) return _match;
    const escaped = inner.replace(/\(/g, '#40;').replace(/\)/g, '#41;');
    return `("${escaped}")`;
  });
  return result;
}

/**
 * Mermaid subgraph IDs cannot contain spaces when referenced in edges.
 * AI-generated diagrams often produce `subgraph My Label` and then use
 * `My Label --> Other Label` in edges, which causes parse errors.
 *
 * This rewrites:
 *   subgraph Some Name    →  subgraph someName["Some Name"]
 * and replaces edge references from the old spaced name to the new camelCase ID.
 */
function sanitizeSubgraphIds(source: string): string {
  const lines = source.split('\n');
  const idMap = new Map<string, string>();

  // Pass 1: find subgraph lines with spaced IDs (no bracket label already)
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)subgraph\s+(?!end\b)(.+)$/);
    if (!m) continue;
    const raw = m[2].trim();
    // Already has a bracket label like subgraph id["label"] — skip
    if (/\[.*\]/.test(raw) || !/\s/.test(raw)) continue;

    const camelId = raw
      .split(/\s+/)
      .map((w, j) =>
        j === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      )
      .join('');
    idMap.set(raw, camelId);
    lines[i] = `${m[1]}subgraph ${camelId}["${raw}"]`;
  }

  if (idMap.size === 0) return source;

  // Pass 2: replace spaced names in edge references
  let result = lines.join('\n');
  for (const [spacedName, camelId] of idMap) {
    // Replace occurrences outside subgraph definitions (edge references)
    const escaped = spacedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(
      new RegExp(`(?<!subgraph\\s.*)\\b${escaped}\\b`, 'g'),
      camelId
    );
  }
  return result;
}

/**
 * Diagram types that are reliably bundled and render without dynamic chunk imports.
 * Mermaid v11 lazy-loads many diagram types (mindmap, timeline, etc.) as separate
 * JS chunks. These chunks can fail to load after a new deployment when the browser
 * has stale hashes cached. Restricting to this allowlist avoids that failure mode.
 */
const SUPPORTED_DIAGRAM_TYPES = new Set([
  'flowchart',
  'graph',
  'sequencediagram',
  'classdiagram',
  'erdiagram',
  'statediagram',
  'statediagramv2',
]);

/**
 * Extract the diagram type keyword from the first non-empty line of Mermaid source.
 * Returns the type lowercased with hyphens/spaces removed, or null if unrecognisable.
 */
function extractDiagramType(source: string): string | null {
  const firstLine = source.split('\n').find((l) => l.trim().length > 0)?.trim() ?? '';
  // The first token before any whitespace or special char is the diagram type
  const m = firstLine.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
  if (!m) return null;
  return m[1].toLowerCase().replace(/-/g, '');
}

function sanitizeMermaidCode(source: string): string {
  return sanitizeSubgraphIds(sanitizeParenLabels(sanitizeBracketLabels(source)));
}

export const MermaidDiagram: React.FC<IMermaidDiagram> = ({ code, className }) => {
  const reactId = useId().replace(/:/g, '');
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setError(null);
      const trimmed = sanitizeMermaidCode(code?.trim() ?? '');
      if (!trimmed) {
        setSvg(null);
        return;
      }

      // Block unsupported diagram types before Mermaid attempts a dynamic
      // chunk import that may fail after redeployments (stale chunk hashes).
      const diagramType = extractDiagramType(trimmed);
      if (diagramType && !SUPPORTED_DIAGRAM_TYPES.has(diagramType)) {
        setSvg(null);
        setError(
          `Unsupported diagram type "${diagramType}". ` +
          `Only flowchart, graph, sequenceDiagram, classDiagram, erDiagram, and stateDiagram are supported.`
        );
        return;
      }

      ensureMermaidInit();
      const id = `mermaid-${reactId}-${Math.random().toString(36).slice(2, 9)}`;
      try {
        const { svg: out } = await mermaid.render(id, trimmed);
        if (!cancelled) {
          setSvg(out);
        }
      } catch (e) {
        if (!cancelled) {
          setSvg(null);
          setError(e instanceof Error ? e.message : 'Failed to render diagram');
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  if (error) {
    return (
      <div
        className={cn(
          'rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm',
          className
        )}
      >
        <p className="font-medium text-destructive">Diagram could not be rendered</p>
        <p className="mt-1 text-muted-foreground">{error}</p>
        <pre className="mt-3 max-h-40 overflow-auto rounded bg-muted/50 p-2 text-xs text-muted-foreground">
          {code}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        className={cn(
          'flex min-h-[120px] items-center justify-center rounded-lg border border-border bg-muted/20',
          className
        )}
      >
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'mermaid-diagram flex max-h-[min(70vh,520px)] justify-center overflow-auto rounded-lg border border-border bg-card p-4',
        className
      )}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
