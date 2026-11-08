import { parseDocument } from 'htmlparser2';
import { marked } from 'marked';

type IHtmlNode = ReturnType<typeof parseDocument>['children'][number];

export interface IDocumentSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  href?: string;
}
export interface IDocumentBlock {
  kind: 'heading' | 'paragraph' | 'quote' | 'code' | 'list' | 'image' | 'placeholder';
  spans: IDocumentSpan[];
  level?: number;
  imageUrl?: string;
  alt?: string;
}

function isElement(node: IHtmlNode): node is Extract<IHtmlNode, { type: 'tag' | 'script' | 'style' }> {
  return node.type === 'tag' || node.type === 'script' || node.type === 'style';
}

function collectInline(nodes: IHtmlNode[], style: Omit<IDocumentSpan, 'text'> = {}): IDocumentSpan[] {
  const spans: IDocumentSpan[] = [];
  for (const node of nodes) {
    if (node.type === 'text') {
      spans.push({ ...style, text: node.data });
    } else if (isElement(node)) {
      if (['script', 'style'].includes(node.name)) continue;
      if (['svg', 'canvas', 'iframe'].includes(node.name) || /\b(mermaid|diagram|interactive)\b/i.test(node.attribs.class ?? '')) {
        spans.push({ ...style, text: '[Interactive content is available in the original document.]' });
        continue;
      }
      if (node.name === 'br') { spans.push({ ...style, text: '\n' }); continue; }
      const next = { ...style, bold: style.bold || ['strong', 'b'].includes(node.name), italic: style.italic || ['em', 'i'].includes(node.name), code: style.code || node.name === 'code', href: node.name === 'a' ? node.attribs.href : style.href };
      spans.push(...collectInline(node.children, next));
    }
  }
  return spans;
}

export function parseDocumentBlocks(content: string, format: 'html' | 'markdown'): IDocumentBlock[] {
  const html = format === 'markdown' ? marked.parser(marked.lexer(content)) : content;
  const root = parseDocument(html);
  const blocks: IDocumentBlock[] = [];
  const add = (kind: IDocumentBlock['kind'], nodes: IHtmlNode[], extra: Partial<IDocumentBlock> = {}) => {
    const spans = collectInline(nodes);
    if (spans.some((span) => span.text.trim())) blocks.push({ kind, spans, ...extra });
  };
  const walk = (nodes: IHtmlNode[], depth = 0) => {
    for (const node of nodes) {
      if (node.type === 'text') {
        if (node.data.trim()) blocks.push({ kind: 'paragraph', spans: [{ text: node.data }] });
        continue;
      }
      if (!isElement(node)) continue;
      const tag = node.name.toLowerCase();
      if (['script', 'style', 'head', 'noscript'].includes(tag)) continue;
      if (['svg', 'canvas', 'iframe', 'video', 'audio'].includes(tag) || /\b(mermaid|diagram|interactive)\b/i.test(node.attribs.class ?? '')) {
        blocks.push({ kind: 'placeholder', spans: [{ text: 'Interactive content is available in the original document.' }] });
      } else if (tag === 'pre' && node.children.some((child) => isElement(child) && /\b(language-mermaid|mermaid)\b/i.test(child.attribs.class ?? ''))) {
        blocks.push({ kind: 'placeholder', spans: [{ text: 'Diagram is available in the original document.' }] });
      } else if (/^h[1-6]$/.test(tag)) add('heading', node.children, { level: Number(tag[1]) });
      else if (tag === 'p') {
        if (node.children.some((child) => isElement(child) && child.name === 'img')) walk(node.children, depth);
        else add('paragraph', node.children);
      } else if (tag === 'blockquote') add('quote', node.children);
      else if (tag === 'pre') add('code', node.children);
      else if (tag === 'li') {
        const inline = node.children.filter((child) => !isElement(child) || !['ul', 'ol'].includes(child.name));
        add('list', inline, { level: depth });
        for (const child of node.children) if (isElement(child) && ['ul', 'ol'].includes(child.name)) walk(child.children, depth + 1);
      } else if (tag === 'ul' || tag === 'ol') walk(node.children, depth);
      else if (tag === 'img') blocks.push({ kind: 'image', spans: [], imageUrl: node.attribs.src, alt: node.attribs.alt });
      else if (tag === 'tr') {
        const cells = node.children.filter((child) => isElement(child) && ['td', 'th'].includes(child.name));
        const spans = cells.flatMap((cell, index) => [...(index ? [{ text: ' | ' }] : []), ...collectInline(isElement(cell) ? cell.children : [])]);
        if (spans.length) blocks.push({ kind: 'paragraph', spans });
      } else if (['div', 'section', 'article', 'main', 'body', 'html', 'table', 'thead', 'tbody', 'tfoot'].includes(tag)) walk(node.children, depth);
      else if (tag === 'a' || tag === 'span' || tag === 'strong' || tag === 'em') add('paragraph', [node]);
      else walk(node.children, depth);
    }
  };
  walk(root.children);
  return blocks;
}
