import { describe, expect, it } from 'vitest';
import { validateMermaidBlocks } from './mermaid-validator';

describe('validateMermaidBlocks', () => {
  it('accepts language-mermaid pre/code blocks', () => {
    const html = `<h2>Flow</h2>
<pre><code class="language-mermaid">flowchart TD
  A-->B
</code></pre>`;
    expect(validateMermaidBlocks(html)).toEqual([]);
  });

  it('does not flag Python LangGraph code inside language-python blocks', () => {
    const html = `<h2>The graph</h2>
<pre><code class="language-python">def build_orchestrator():
    graph = StateGraph(AgentState)
    graph.add_node("supervisor", supervisor_node)
    graph.add_edge(START, "supervisor")
    return graph.compile()
</code></pre>`;
    expect(validateMermaidBlocks(html)).toEqual([]);
  });

  it('does not flag bare graph= assignment lines as indented Mermaid', () => {
    const html = `<p>Build step</p>
    graph = StateGraph(AgentState)
    graph.add_node("supervisor", supervisor_node)
`;
    expect(
      validateMermaidBlocks(html).filter(
        (finding) => finding.code === 'MERMAID_INDENTED_BLOCK',
      ),
    ).toEqual([]);
  });

  it('flags indented Mermaid openers outside pre blocks', () => {
    const html = `<p>Overview</p>
    flowchart TD
      A-->B
`;
    const findings = validateMermaidBlocks(html);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe('MERMAID_INDENTED_BLOCK');
  });

  it('flags indented graph with a Mermaid direction', () => {
    const html = `<p>Overview</p>
    graph TD
      A-->B
`;
    const findings = validateMermaidBlocks(html);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe('MERMAID_INDENTED_BLOCK');
  });

  it('flags unsupported mermaid diagram types inside language-mermaid blocks', () => {
    const html = `<pre><code class="language-mermaid">gantt
  title Demo
</code></pre>`;
    const findings = validateMermaidBlocks(html);
    expect(findings.some((finding) => finding.code === 'MERMAID_UNSUPPORTED_TYPE')).toBe(
      true,
    );
  });
});
