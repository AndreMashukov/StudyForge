import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { applyMermaidLabelTooltips } from './apply-mermaid-label-tooltips';
import { sanitizeMermaidCode } from './sanitize-mermaid-code';
import { neutralizeMermaidQuizStyles } from './neutralize-mermaid-quiz-styles';
import {
  BANNED_DIAGRAM_TYPES,
  SUPPORTED_DIAGRAM_TYPES,
  extractDiagramType,
} from './supported-diagram-types';

type DOMPurifyWindow = Parameters<typeof createDOMPurify>[0];
type MermaidModule = typeof import('mermaid').default;

const nodeRequire = createRequire(__filename);

let mermaidInitPromise: Promise<MermaidModule> | null = null;

function patchDompurifyModule(
  purify: ReturnType<typeof createDOMPurify>
): void {
  const dompurifyPath = nodeRequire.resolve('dompurify');
  nodeRequire.cache[dompurifyPath] = {
    id: dompurifyPath,
    filename: dompurifyPath,
    loaded: true,
    exports: {
      __esModule: true,
      default: purify,
      ...purify,
    },
  } as NodeModule;
}

async function getMermaid(): Promise<MermaidModule> {
  if (!mermaidInitPromise) {
    mermaidInitPromise = initMermaid();
  }
  return mermaidInitPromise;
}

async function initMermaid(): Promise<MermaidModule> {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const { window } = dom;
  const purify = createDOMPurify(window as unknown as DOMPurifyWindow);

  const globalScope = globalThis as Record<string, unknown>;
  globalScope.window = window;
  globalScope.document = window.document;
  globalScope.DOMPurify = purify;

  patchDompurifyModule(purify);

  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'neutral',
  });
  return mermaid;
}

export interface IMermaidValidationResult {
  ok: boolean;
  sanitized: string;
  error?: string;
  diagramType?: string | null;
}

export async function validateMermaidDiagram(source: string): Promise<IMermaidValidationResult> {
  const sanitized = neutralizeMermaidQuizStyles(
    applyMermaidLabelTooltips(sanitizeMermaidCode(source.trim()))
  );
  if (!sanitized) {
    return { ok: false, sanitized, error: 'Diagram source is empty' };
  }

  const diagramType = extractDiagramType(sanitized);
  if (!diagramType) {
    return { ok: false, sanitized, error: 'Could not detect diagram type', diagramType };
  }

  if (BANNED_DIAGRAM_TYPES.has(diagramType)) {
    return {
      ok: false,
      sanitized,
      error: `Diagram type "${diagramType}" is not allowed`,
      diagramType,
    };
  }

  if (!SUPPORTED_DIAGRAM_TYPES.has(diagramType)) {
    return {
      ok: false,
      sanitized,
      error: `Diagram type "${diagramType}" is not supported for rendering`,
      diagramType,
    };
  }

  try {
    const mermaid = await getMermaid();
    await mermaid.parse(sanitized);
    return { ok: true, sanitized, diagramType };
  } catch (error) {
    return {
      ok: false,
      sanitized,
      error: error instanceof Error ? error.message : String(error),
      diagramType,
    };
  }
}
