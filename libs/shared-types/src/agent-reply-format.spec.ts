import { describe, expect, it } from 'vitest';
import {
  agentReplyEmbedPayloadSchema,
  agentReplyNeedsRichView,
  normalizeAgentReplyMarkdown,
} from './agent-reply-format';

// What JSON.parse makes of LaTeX whose backslashes were not doubled.
const parsedFromJson = (raw: string): string => JSON.parse(`"${raw}"`);

describe('normalizeAgentReplyMarkdown', () => {
  it('restores commands lost to JSON escapes', () => {
    const damaged = parsedFromJson('Area $\\frac{a}{b}$ and $\\beta \\theta \\rho$.');
    expect(damaged).toContain('\f');
    expect(normalizeAgentReplyMarkdown(damaged)).toBe(
      'Area $\\frac{a}{b}$ and $\\beta \\theta \\rho$.',
    );
  });

  it('restores a lost \\n inside inline math, and only known commands in display math', () => {
    expect(normalizeAgentReplyMarkdown(parsedFromJson('$\\nabla f$'))).toBe('$\\nabla f$');
    expect(normalizeAgentReplyMarkdown(parsedFromJson('$$a \\neq b$$'))).toBe('$$\na \\neq b\n$$');
    expect(normalizeAgentReplyMarkdown('$$\nE = mc^2\n$$')).toBe('$$\nE = mc^2\n$$');
  });

  it('converts \\( \\) and \\[ \\] to dollar delimiters', () => {
    expect(normalizeAgentReplyMarkdown('Inline \\(x^2\\) and \\[\\int_0^1 x\\,dx\\] here')).toBe(
      'Inline $x^2$ and $$\\int_0^1 x\\,dx$$ here',
    );
  });

  it('puts a one-line display formula on lines of its own', () => {
    expect(normalizeAgentReplyMarkdown('Neuron:\n\n$$y = \\sigma(x)$$\n\nDone.')).toBe(
      'Neuron:\n\n$$\ny = \\sigma(x)\n$$\n\nDone.',
    );
    expect(normalizeAgentReplyMarkdown('\\[E = mc^2\\]')).toBe('$$\nE = mc^2\n$$');
    expect(normalizeAgentReplyMarkdown('Mid $$x$$ sentence')).toBe('Mid $$x$$ sentence');
  });

  it('leaves code blocks and inline code alone', () => {
    const fenced = '```js\nconst s = "\\(x\\)";\n\t\f\n```\nUse `\\(a\\)` here.';
    expect(normalizeAgentReplyMarkdown(fenced)).toBe(fenced);
  });

  it('leaves well-formed replies unchanged', () => {
    const reply = '| A | B |\n|---|---|\n| 1 | 2 |\n\nSee $\\frac{1}{2}$.\n\n$$\nE = mc^2\n$$\n\n```mermaid\nflowchart TD\n  A --> B\n```';
    expect(normalizeAgentReplyMarkdown(reply)).toBe(reply);
  });
});

describe('agentReplyNeedsRichView', () => {
  it('detects diagrams, plots, tables and formulas', () => {
    expect(agentReplyNeedsRichView('```mermaid\nflowchart TD\n  A --> B\n```')).toBe(true);
    expect(agentReplyNeedsRichView('```plotly\n{"data":[]}\n```')).toBe(true);
    expect(agentReplyNeedsRichView('| A | B |\n|---|---|\n| 1 | 2 |')).toBe(true);
    expect(agentReplyNeedsRichView('$$E = mc^2$$')).toBe(true);
    expect(agentReplyNeedsRichView('Slope is $m$ here and $\\frac{a}{b}$.')).toBe(true);
  });

  it('ignores prices, plain text and code', () => {
    expect(agentReplyNeedsRichView('It costs $5 and $10 a month.')).toBe(false);
    expect(agentReplyNeedsRichView('Between $5-$10.')).toBe(false);
    expect(agentReplyNeedsRichView('I created 2 documents. Estimated cost: 40 credits.')).toBe(false);
    expect(agentReplyNeedsRichView('```bash\necho $HOME $PATH\n```')).toBe(false);
    expect(agentReplyNeedsRichView('Escaped \\$5 and \\$10.')).toBe(false);
  });
});

describe('agentReplyEmbedPayloadSchema', () => {
  it('defaults the theme', () => {
    expect(agentReplyEmbedPayloadSchema.parse({ markdown: 'x' })).toEqual({
      markdown: 'x',
      theme: 'dark',
    });
  });
});
