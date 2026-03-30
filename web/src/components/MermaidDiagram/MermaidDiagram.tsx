import React, { useEffect, useId, useState } from 'react';
import mermaid from 'mermaid';
import { cn } from '../../lib/utils';
import { IMermaidDiagram } from './IMermaidDiagram';

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
 * When AI-generated diagrams use these bare in labels the lexer/parser throws.
 * Wrap any affected label content in double-quotes so Mermaid treats it as a
 * plain string, e.g. [/usage] -> ["/usage"], [@mention] -> ["@mention"].
 */
function sanitizeMermaidCode(source: string): string {
  return source.replace(
    /\[([^\]"]*[/@\\][^\]"]*)\]/g,
    (_match, inner: string) => `["${inner}"]`
  );
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
