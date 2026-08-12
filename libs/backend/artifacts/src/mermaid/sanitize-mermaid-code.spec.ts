import { describe, expect, it } from 'vitest';
import {
  findSingleQuotedBracketLabels,
  sanitizeMermaidCode,
  sanitizeSequenceDiagramUnsupportedStyles,
  sanitizeSingleQuotedBracketLabels,
} from './sanitize-mermaid-code';

describe('sanitizeSingleQuotedBracketLabels', () => {
  it('rewrites single-quoted labels to plain or double-quoted form', () => {
    const source = `flowchart TD
  User['User Request'] --> Agent['LlmAgent']
  cfg['include_contents='none'']
  prompt[''History Only'']
  V1['{var}']
  V2['$var']`;

    const sanitized = sanitizeSingleQuotedBracketLabels(source);
    expect(sanitized).toContain('User[User Request]');
    expect(sanitized).toContain('Agent[LlmAgent]');
    expect(sanitized).toContain('cfg["include_contents=none"]');
    expect(sanitized).toContain('prompt[History Only]');
    expect(sanitized).toContain('V1["{var}"]');
    expect(sanitized).toContain('V2["$var"]');
    expect(findSingleQuotedBracketLabels(sanitized)).toEqual([]);
  });

  it('leaves already-valid labels unchanged', () => {
    const source = `flowchart TD
  User[User Request] --> Agent["LlmAgent"]
  cfg["include_contents=none"]
  A["path/with'apostrophe"]`;
    expect(sanitizeSingleQuotedBracketLabels(source)).toBe(source);
  });

  it('is applied by sanitizeMermaidCode', () => {
    const sanitized = sanitizeMermaidCode(`flowchart TD\n  X['include_contents='none'']`);
    expect(sanitized).toContain('X["include_contents=none"]');
    expect(findSingleQuotedBracketLabels(sanitized)).toEqual([]);
  });
});

describe('sanitizeSequenceDiagramUnsupportedStyles', () => {
  it('strips style lines from sequence diagrams', () => {
    const source = `sequenceDiagram
  participant Helper
  Helper->>User: hi
  style Helper fill:#2b6cb0,color:#fff`;
    const sanitized = sanitizeSequenceDiagramUnsupportedStyles(source);
    expect(sanitized).toContain('Helper->>User: hi');
    expect(sanitized).not.toMatch(/^\s*style\b/m);
  });

  it('leaves flowchart style lines alone', () => {
    const source = `flowchart TD
  A --> B
  style A fill:#2b6cb0,color:#fff`;
    expect(sanitizeSequenceDiagramUnsupportedStyles(source)).toBe(source);
  });

  it('is applied by sanitizeMermaidCode', () => {
    const sanitized = sanitizeMermaidCode(`sequenceDiagram
  participant Helper
  Helper->>User: hi
  style Helper fill:#2b6cb0,color:#fff`);
    expect(sanitized).not.toMatch(/^\s*style\b/m);
  });
});

describe('findSingleQuotedBracketLabels', () => {
  it('flags single-quoted bracket labels', () => {
    const source = `flowchart TD
  User['User Request'] --> Agent['LlmAgent']
  cfg['include_contents='none'']`;
    expect(findSingleQuotedBracketLabels(source)).toEqual([
      "['User Request']",
      "['LlmAgent']",
      "['include_contents='none'']",
    ]);
  });

  it('allows plain and double-quoted labels', () => {
    const source = `flowchart TD
  User[User Request] --> Agent["LlmAgent"]
  cfg["include_contents=none"]
  A["path/with'apostrophe"]`;
    expect(findSingleQuotedBracketLabels(source)).toEqual([]);
  });
});
