import { describe, expect, it } from 'vitest';
import { parseDocumentBlocks } from './documentBlocks';

describe('native document reader', () => {
  it('reads HTML text, formatting, lists, code, images and links without scripts', () => {
    const blocks = parseDocumentBlocks('<h1>Hello</h1><p>A <strong>bold</strong> <a href="https://example.com">link</a></p><ul><li>First</li></ul><pre><code>const x = 1;</code></pre><img src="https://example.com/a.png" alt="A"><script>bad()</script>', 'html');
    expect(blocks.map((block) => block.kind)).toEqual(['heading', 'paragraph', 'list', 'code', 'image']);
    expect(blocks[1].spans).toContainEqual(expect.objectContaining({ text: 'bold', bold: true }));
    expect(blocks[1].spans).toContainEqual(expect.objectContaining({ text: 'link', href: 'https://example.com' }));
    expect(JSON.stringify(blocks)).not.toContain('bad()');
  });
  it('converts Markdown and displays unsupported diagrams as placeholders', () => {
    const blocks = parseDocumentBlocks('# Heading\n\n- Item\n\n```mermaid\ngraph TD\n```\n\n| A | B |\n| --- | --- |\n| x | y |', 'markdown');
    expect(blocks.some((block) => block.kind === 'heading' && block.spans[0].text === 'Heading')).toBe(true);
    expect(blocks.some((block) => block.kind === 'list')).toBe(true);
    expect(blocks.some((block) => block.kind === 'placeholder')).toBe(true);
    expect(blocks.some((block) => block.spans.map((span) => span.text).join('').includes('x | y'))).toBe(true);
  });
});
