import mermaid from 'mermaid';
import { sanitizeMermaidCode } from './sanitize-mermaid-code';
import {
  BANNED_DIAGRAM_TYPES,
  SUPPORTED_DIAGRAM_TYPES,
  extractDiagramType,
} from './supported-diagram-types';

let mermaidInitialized = false;

function ensureMermaidInit(): void {
  if (mermaidInitialized) {
    return;
  }
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'neutral',
  });
  mermaidInitialized = true;
}

export interface IMermaidValidationResult {
  ok: boolean;
  sanitized: string;
  error?: string;
  diagramType?: string | null;
}

export async function validateMermaidDiagram(source: string): Promise<IMermaidValidationResult> {
  const sanitized = sanitizeMermaidCode(source.trim());
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

  ensureMermaidInit();
  try {
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
