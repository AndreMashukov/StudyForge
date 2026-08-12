import { describe, expect, it } from 'vitest';
import { applyMermaidLabelTooltips } from './apply-mermaid-label-tooltips';

describe('applyMermaidLabelTooltips', () => {
  it('strips double-quoted hash click tooltip directives', () => {
    const source = `flowchart TD
  classifyIntent[Classify]
  click classifyIntent "#" "classify_intent routes fan-out"`;
    const result = applyMermaidLabelTooltips(source);
    expect(result.source).toContain('classifyIntent[Classify]');
    expect(result.source).not.toMatch(/^\s*click\b/m);
  });

  it('strips single-quoted hash click tooltip directives', () => {
    const source = `flowchart TD
  classifyIntent[Classify]
  click classifyIntent '#' 'intent summarization path'`;
    const result = applyMermaidLabelTooltips(source);
    expect(result.source).toContain('classifyIntent[Classify]');
    expect(result.source).not.toMatch(/^\s*click\b/m);
  });

  it('strips truncated single-quoted hash click lines that break Mermaid parse', () => {
    const source = `flowchart TD
  A[Start] --> B[End]
  click classifyIntent '#' 'intent summarizatio`;
    const result = applyMermaidLabelTooltips(source);
    expect(result.source).toContain('A[Start] --> B[End]');
    expect(result.source).not.toMatch(/click classifyIntent/i);
  });
});
