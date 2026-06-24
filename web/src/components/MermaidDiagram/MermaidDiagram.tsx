import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import mermaid from 'mermaid';
import Panzoom, { type PanzoomObject } from '@panzoom/panzoom';
import { Focus, Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '../../lib/utils';
import { applyMermaidLabelTooltips } from '../../utils/applyMermaidLabelTooltips';
import { IMermaidDiagram } from './IMermaidDiagram';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/Button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/Tooltip';

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
 * Mermaid v10/v11's render() is not concurrent-safe: calling it from two
 * components at the same time corrupts its internal DOM state and throws
 * "Cannot read properties of null (reading 'firstChild')".
 *
 * This module-level promise queue serialises all render() calls so only one
 * runs at a time.  Stale renders (where the component re-rendered before the
 * queued call ran) are skipped via the per-effect `cancelled` flag.
 */
let renderQueue: Promise<void> = Promise.resolve();

/**
 * Mermaid reserves certain characters inside square-bracket node labels:
 *   /  \ — trigger trapezoid shape syntax
 *   @    — parsed as a link ID token
 *   ( )  — parsed as sub-graph / stadium shape tokens
 *   [ ]  — parsed as another node label when nested inside an outer [...]
 * When AI-generated diagrams use these bare in labels the lexer/parser throws.
 * Wrap any affected label content in double-quotes so Mermaid treats it as a
 * plain string, e.g. [dfs(A)] -> ["dfs(A)"], [s[end]] -> ["s[end]"].
 *
 * All matches are intentionally kept within a single line (via \n exclusion)
 * to prevent the greedy quantifiers from spanning multiple nodes.
 */
function sanitizeBracketLabels(source: string): string {
  // Handle labels containing special shape-syntax chars: / @ \ ( )
  let result = source.replace(
    /\[([^\]"\n]*[/@\\()][^\]"\n]*)\]/g,
    (_match, inner: string) => `["${inner}"]`,
  );
  // Handle labels with nested square brackets like [text s[end]] or [freq of s[start]].
  // [^\["\n\]]+ — requires ≥1 char before the inner [, and excludes newlines and ] to
  // prevent the match spanning across multiple node definitions.
  result = result.replace(
    /\[([^\["\n\]]+\[[^\]\n]*\][^\]"\n]*)\]/g,
    (_match, inner: string) => `["${inner}"]`,
  );
  return result;
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

/**
 * Handles square brackets [...] appearing inside unquoted paren node labels:
 *   B(Add a[i-m])   →  B(Add a#91;i-m#93;)
 *   C(Remove a[i])  →  C(Remove a#91;i#93;)
 *
 * Mermaid's lexer treats [ inside a (label) as a new node shape token, causing
 * parse errors. Replace with Mermaid HTML-entity shorthand #91; and #93;.
 *
 * The [^()'"\n\[]+ quantifier (requires ≥1 char before the inner [) intentionally
 * excludes stadium shapes like ([label]) and ((circle)) which start with [ or (.
 */
function sanitizeSquareBracketsInParenLabels(source: string): string {
  return source.replace(
    /\(([^()'"\n\[]+\[[^\]\n]*\][^()'"\n]*)\)/g,
    (_match, inner: string) => {
      const escaped = inner.replace(/\[/g, '#91;').replace(/\]/g, '#93;');
      return `(${escaped})`;
    },
  );
}

/**
 * Square brackets inside diamond {condition} node labels cause parse errors.
 * Mermaid's lexer treats [ inside a {label} as a new node shape token (SQS).
 * Example:
 *   C{nums[r] > nums[deque.last]?}  ← parse error
 *   C{nums#91;r#93; > nums#91;deque.last#93;?}  ← works
 *
 * Replace [ and ] inside {…} labels with HTML-entity shorthand #91; and #93;.
 */
function sanitizeSquareBracketsInDiamondLabels(source: string): string {
  return source.replace(
    /\{([^{}\n]*\[[^\]\n]*\][^{}\n]*)\}/g,
    (_match, inner: string) => {
      const escaped = inner.replace(/\[/g, '#91;').replace(/\]/g, '#93;');
      return `{${escaped}}`;
    },
  );
}

/**
 * Handles double-nested square brackets inside bracket node labels.
 * The existing sanitizeBracketLabels only handles one level of nesting and
 * partially wraps the label (e.g. ["Board[r][c"]) leaving the tail dangling,
 * which causes a mermaid lexical error.
 *
 * This function walks each line character-by-character. When it detects a
 * bracket node label (wordId[...]) it tracks nesting depth and encodes any
 * inner [ and ] with #91; / #93; HTML entities so mermaid sees a flat label.
 *
 * Example:
 *   Choose[✅ Choose: Add to Sets, Board[r][c] = 'Q']
 *   → Choose[✅ Choose: Add to Sets, Board#91;r#93;#91;c#93; = 'Q']
 */
function sanitizeNestedBracketsInBracketLabels(source: string): string {
  return source
    .split('\n')
    .map((line) => {
      let result = '';
      let i = 0;
      while (i < line.length) {
        // Detect a bracket node label: one or more word chars followed by '['
        const wordBracket = line.slice(i).match(/^(\w+)\[/);
        if (wordBracket) {
          result += wordBracket[1] + '[';
          i += wordBracket[0].length;
          let depth = 1;
          let label = '';
          while (i < line.length && depth > 0) {
            const ch = line[i];
            if (ch === '[') {
              depth++;
              label += '#91;';
            } else if (ch === ']') {
              depth--;
              if (depth > 0) {
                label += '#93;';
              } else {
                result += label + ']';
              }
            } else {
              label += ch;
            }
            i++;
          }
        } else {
          result += line[i];
          i++;
        }
      }
      return result;
    })
    .join('\n');
}

function sanitizeMermaidCode(source: string): string {
  return sanitizeSubgraphIds(
    sanitizeParenLabels(
      sanitizeSquareBracketsInParenLabels(
        sanitizeSquareBracketsInDiamondLabels(
          sanitizeBracketLabels(
            sanitizeNestedBracketsInBracketLabels(source),
          ),
        ),
      ),
    ),
  );
}

const PANZOOM_MIN_SCALE = 0.5;
const PANZOOM_MAX_SCALE = 4;

export const MermaidDiagram: React.FC<IMermaidDiagram> = ({
  code,
  className,
  enablePanZoom = true,
}) => {
  const diagramRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const svgHostRef = useRef<HTMLDivElement | null>(null);
  const panzoomRef = useRef<PanzoomObject | null>(null);
  const reactId = useId().replace(/:/g, '');
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [renderAttempt, setRenderAttempt] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenSupported, setIsFullscreenSupported] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);

  const fullscreenLabel = isFullscreen ? 'Exit fullscreen' : 'View fullscreen';

  const handleZoomIn = useCallback(() => {
    panzoomRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    panzoomRef.current?.zoomOut();
  }, []);

  const handleResetZoom = useCallback(() => {
    panzoomRef.current?.reset();
  }, []);

  const handleRetry = () => {
    setError(null);
    setSvg(null);
    setRenderAttempt((attempt) => attempt + 1);
  };

  const handleFullscreenToggle = async () => {
    const diagramElement = diagramRef.current;
    if (!diagramElement) return;

    setFullscreenError(null);

    try {
      if (document.fullscreenElement === diagramElement) {
        await document.exitFullscreen();
        return;
      }

      if (!document.fullscreenEnabled || typeof diagramElement.requestFullscreen !== 'function') {
        setFullscreenError('Fullscreen is unavailable in this browser.');
        return;
      }

      await diagramElement.requestFullscreen();
    } catch (fullscreenRequestError) {
      setFullscreenError(
        fullscreenRequestError instanceof Error
          ? fullscreenRequestError.message
          : 'Fullscreen is unavailable in this browser.'
      );
    }
  };

  useEffect(() => {
    setIsFullscreenSupported(
      document.fullscreenEnabled && typeof document.exitFullscreen === 'function'
    );

    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === diagramRef.current);
    };

    const handleFullscreenError = () => {
      setFullscreenError('Fullscreen is unavailable in this browser.');
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('fullscreenerror', handleFullscreenError);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('fullscreenerror', handleFullscreenError);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Reset display state immediately so the spinner shows while waiting in queue.
    setError(null);
    setSvg(null);

    const trimmed = applyMermaidLabelTooltips(sanitizeMermaidCode(code?.trim() ?? ''));
    if (!trimmed) {
      return () => { cancelled = true; };
    }

    // Block unsupported diagram types before Mermaid attempts a dynamic
    // chunk import that may fail after redeployments (stale chunk hashes).
    const diagramType = extractDiagramType(trimmed);
    if (diagramType && !SUPPORTED_DIAGRAM_TYPES.has(diagramType)) {
      setError(
        `Unsupported diagram type "${diagramType}". ` +
        `Only flowchart, graph, sequenceDiagram, classDiagram, erDiagram, and stateDiagram are supported.`
      );
      return () => { cancelled = true; };
    }

    // Enqueue this render after any in-flight render completes.
    // The .catch keeps the chain alive even if a previous render threw.
    renderQueue = renderQueue
      .then(async () => {
        if (cancelled) return;

        ensureMermaidInit();
        const id = `mermaid-${reactId}-${Math.random().toString(36).slice(2, 9)}`;
        try {
          const { svg: out } = await mermaid.render(id, trimmed);
          if (!cancelled) {
            setSvg(out);
          }
        } catch (renderError) {
          // Mermaid appends an error SVG to <body> on failure (div#d${id}).
          // Remove it so it doesn't linger as a floating "Syntax error" tooltip.
          document.getElementById(`d${id}`)?.remove();
          if (!cancelled) {
            setSvg(null);
            setError(renderError instanceof Error ? renderError.message : 'Failed to render diagram');
          }
        }
      })
      .catch((_err: unknown) => { /* ignore render errors handled in the async block above */ });

    return () => {
      cancelled = true;
    };
  }, [code, reactId, renderAttempt]);

  useEffect(() => {
    if (!svg || !enablePanZoom) {
      return undefined;
    }

    const host = svgHostRef.current;
    const viewport = viewportRef.current;
    if (!host || !viewport) {
      return undefined;
    }

    const svgElement = host.querySelector('svg');
    if (!(svgElement instanceof SVGSVGElement)) {
      return undefined;
    }

    const panzoom = Panzoom(svgElement, {
      minScale: PANZOOM_MIN_SCALE,
      maxScale: PANZOOM_MAX_SCALE,
      step: 0.25,
      canvas: true,
      cursor: 'grab',
      contain: 'outside',
    });
    panzoomRef.current = panzoom;

    const handleWheel = (event: WheelEvent) => {
      panzoom.zoomWithWheel(event);
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      viewport.removeEventListener('wheel', handleWheel);
      panzoom.destroy();
      panzoomRef.current = null;
    };
  }, [svg, enablePanZoom, isFullscreen]);

  if (error) {
    return (
      <div
        className={cn(
          'flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm',
          className
        )}
        role="alert"
      >
        <p className="font-medium text-destructive">error in diagram</p>
        <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Retry
        </Button>
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
      ref={diagramRef}
      className={cn(
        'mermaid-diagram relative flex max-h-[min(70vh,520px)] overflow-hidden rounded-lg border border-border bg-card',
        className,
        isFullscreen && 'h-screen max-h-none w-screen rounded-none border-0 bg-background'
      )}
    >
      <TooltipProvider>
        <div
          className={cn(
            'absolute right-3 top-3 z-10 flex flex-col gap-1.5',
            isFullscreen && 'right-4 top-4 gap-2'
          )}
        >
          {enablePanZoom && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={cn('h-8 w-8 shadow-sm', isFullscreen && 'h-10 w-10')}
                    onClick={handleZoomIn}
                    aria-label="Zoom in"
                    title="Zoom in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Zoom in</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={cn('h-8 w-8 shadow-sm', isFullscreen && 'h-10 w-10')}
                    onClick={handleZoomOut}
                    aria-label="Zoom out"
                    title="Zoom out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Zoom out</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={cn('h-8 w-8 shadow-sm', isFullscreen && 'h-10 w-10')}
                    onClick={handleResetZoom}
                    aria-label="Reset zoom"
                    title="Reset zoom"
                  >
                    <Focus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Reset zoom</TooltipContent>
              </Tooltip>
            </>
          )}
          {isFullscreenSupported && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={cn('h-8 w-8 shadow-sm', isFullscreen && 'h-10 w-10')}
                  onClick={handleFullscreenToggle}
                  aria-label={fullscreenLabel}
                  title={fullscreenLabel}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">{fullscreenLabel}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>

      {enablePanZoom ? (
        <div
          ref={viewportRef}
          className={cn(
            'flex min-h-0 flex-1 touch-none overflow-hidden p-4 pt-14',
            isFullscreen && 'h-full w-full p-6 pt-20'
          )}
        >
          <div
            ref={svgHostRef}
            className="flex h-full w-full items-center justify-center"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      ) : (
        <div
          className={cn(
            'flex min-h-0 flex-1 justify-center overflow-auto p-4 [&_svg]:h-auto [&_svg]:max-w-full',
            isFullscreen && 'h-full w-full items-center p-6 pt-16 [&_svg]:max-h-[calc(100vh-5rem)]'
          )}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}

      {fullscreenError && (
        <p
          className="absolute bottom-3 left-1/2 z-10 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-md border border-destructive/40 bg-background px-3 py-1 text-center text-xs text-destructive shadow-sm"
          role="status"
        >
          {fullscreenError}
        </p>
      )}
    </div>
  );
};
