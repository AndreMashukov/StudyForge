import { describe, expect, it } from 'vitest';
import { applyMermaidLabelTooltips } from './apply-mermaid-label-tooltips';

describe('applyMermaidLabelTooltips', () => {
  it('harvests double-quoted hash click tips and rewrites parse-safe click lines', () => {
    const source = `flowchart TD
  classifyIntent[Classify]
  click classifyIntent "#" "classify_intent routes fan-out"`;
    const result = applyMermaidLabelTooltips(source);
    expect(result.source).toContain('classifyIntent[Classify]');
    expect(result.nodeTooltips.classifyIntent).toBe(
      'classify_intent routes fan-out'
    );
    expect(result.source).toContain(
      'click classifyIntent "#" "classify_intent routes fan-out"'
    );
    expect(result.source).not.toMatch(/click classifyIntent '#'/i);
  });

  it('harvests single-quoted hash click tips and rewrites as double-quoted', () => {
    const source = `flowchart TD
  classifyIntent[Classify]
  click classifyIntent '#' 'intent summarization path'`;
    const result = applyMermaidLabelTooltips(source);
    expect(result.source).toContain('classifyIntent[Classify]');
    expect(result.nodeTooltips.classifyIntent).toBe('intent summarization path');
    expect(result.source).toContain(
      'click classifyIntent "#" "intent summarization path"'
    );
    expect(result.source).not.toMatch(/click classifyIntent '#'/i);
  });

  it('drops truncated single-quoted hash click lines that break Mermaid parse', () => {
    const source = `flowchart TD
  A[Start] --> B[End]
  click classifyIntent '#' 'intent summarizatio`;
    const result = applyMermaidLabelTooltips(source);
    expect(result.source).toContain('A[Start] --> B[End]');
    expect(result.source).not.toMatch(/click classifyIntent/i);
    expect(result.nodeTooltips.classifyIntent).toBeUndefined();
  });

  it('shortens long labels and persists full text as hash click tips', () => {
    const longLabel =
      'ArtifactAgentDefinition contract with artifactKind and displayName';
    const source = `flowchart TD
  rootNode["${longLabel}"]`;
    const result = applyMermaidLabelTooltips(source);
    expect(result.nodeTooltips.rootNode).toBe(longLabel);
    expect(result.source).toMatch(/rootNode\["[^"]{1,28}"\]/);
    expect(result.source).toContain(`click rootNode "#" "${longLabel}"`);
  });

  it('prefers explicit click tip over long label text', () => {
    const source = `flowchart TD
  rootNode["ArtifactAgentDefinition contract with artifactKind"]
  click rootNode "#" "Explicit hover tip wins"`;
    const result = applyMermaidLabelTooltips(source);
    expect(result.nodeTooltips.rootNode).toBe('Explicit hover tip wins');
    expect(result.source).toMatch(/rootNode\["[^"]{1,28}"\]/);
    expect(result.source).toContain('click rootNode "#" "Explicit hover tip wins"');
  });

  it('is idempotent when run twice on rewritten source', () => {
    const source = `flowchart TD
  classifyIntent[Classify]
  click classifyIntent '#' 'intent summarization path'`;
    const once = applyMermaidLabelTooltips(source);
    const twice = applyMermaidLabelTooltips(once.source);
    expect(twice.nodeTooltips).toEqual(once.nodeTooltips);
    expect(twice.source).toBe(once.source);
  });

  it('rewrites the QA Ocean single-quoted hash click into parse-safe quotes', () => {
    const source = `flowchart TD
  Ocean[Ocean]
  click Ocean '#' 'Ocean Water source of evaporation'`;
    const result = applyMermaidLabelTooltips(source);
    expect(result.nodeTooltips.Ocean).toBe('Ocean Water source of evaporation');
    expect(result.source).toContain('click Ocean "#" "Ocean Water source of evaporation"');
    expect(result.source).not.toMatch(/click Ocean '#'/i);
  });

  it('rewrites unicode-quoted hash clicks and mid-line click statements', () => {
    const source = `flowchart TD
  Ocean[Ocean] click Ocean ‘#’ ‘Ocean Water source of evaporation’`;
    const result = applyMermaidLabelTooltips(source);
    expect(result.source).toContain('Ocean[Ocean]');
    expect(result.nodeTooltips.Ocean).toBe('Ocean Water source of evaporation');
    expect(result.source).toContain('click Ocean "#" "Ocean Water source of evaporation"');
    expect(result.source).not.toMatch(/click Ocean ['‘]/i);
  });

  it('drops non-hash click lines that contain single quotes', () => {
    const source = `flowchart TD
  Ocean[Ocean]
  click Ocean href 'https://example.com' 'Ocean Water'`;
    const result = applyMermaidLabelTooltips(source);
    expect(result.source).toContain('Ocean[Ocean]');
    expect(result.source).not.toMatch(/click Ocean href/i);
    expect(result.source).not.toMatch(/'/);
  });
});
