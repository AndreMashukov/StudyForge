import { parseDocument } from 'htmlparser2';
import { marked } from 'marked';

/**
 * Splits a document body into display blocks. The mobile reader renders these
 * blocks, and narration refers to them by index, so the server and the app
 * must run this same code. Changing how blocks are produced changes those
 * indexes: bump `NARRATION_SCHEMA_VERSION` when you do.
 */

type IHtmlNode = ReturnType<typeof parseDocument>['children'][number];

export interface IDocumentSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  href?: string;
  /** Stands in for embedded content (an inline SVG, canvas or diagram); never read aloud. */
  placeholder?: boolean;
}

export type DocumentBlockKind =
  | 'heading'
  | 'paragraph'
  | 'quote'
  | 'code'
  | 'list'
  | 'image'
  | 'table'
  | 'placeholder';

export interface IDocumentBlock {
  kind: DocumentBlockKind;
  spans: IDocumentSpan[];
  level?: number;
  imageUrl?: string;
  alt?: string;
  /** For `placeholder` blocks: what the placeholder stands in for. */
  placeholderOf?: 'diagram' | 'interactive';
  /** For `code` blocks: the fence's language tag, lower case (`language-ts` → `ts`). */
  language?: string;
}

export type DocumentBlockFormat = 'html' | 'markdown';

const INTERACTIVE_CLASS_RE = /\b(mermaid|diagram|interactive)\b/i;
const MERMAID_CODE_CLASS_RE = /\b(language-mermaid|mermaid)\b/i;
const CODE_LANGUAGE_CLASS_RE = /(?:^|\s)(?:language|lang)-([\w+#.-]+)/i;
/** Blocks inside a quote or list item that keep their own kind. */
const CONTAINED_BLOCK_TAGS = new Set(['pre', 'table', 'blockquote']);
const INLINE_PLACEHOLDER_TEXT =
  '[Interactive content is available in the original document.]';

function isElement(
  node: IHtmlNode,
): node is Extract<IHtmlNode, { type: 'tag' | 'script' | 'style' }> {
  return node.type === 'tag' || node.type === 'script' || node.type === 'style';
}

function collectInline(
  nodes: IHtmlNode[],
  style: Omit<IDocumentSpan, 'text'> = {},
): IDocumentSpan[] {
  const spans: IDocumentSpan[] = [];
  for (const node of nodes) {
    if (node.type === 'text') {
      spans.push({ ...style, text: node.data });
    } else if (isElement(node)) {
      if (['script', 'style'].includes(node.name)) continue;
      if (
        ['svg', 'canvas', 'iframe'].includes(node.name) ||
        INTERACTIVE_CLASS_RE.test(node.attribs.class ?? '')
      ) {
        spans.push({
          ...style,
          text: INLINE_PLACEHOLDER_TEXT,
          placeholder: true,
        });
        continue;
      }
      if (node.name === 'br') {
        spans.push({ ...style, text: '\n' });
        continue;
      }
      const next = {
        ...style,
        bold: style.bold || ['strong', 'b'].includes(node.name),
        italic: style.italic || ['em', 'i'].includes(node.name),
        code: style.code || node.name === 'code',
        href: node.name === 'a' ? node.attribs.href : style.href,
      };
      spans.push(...collectInline(node.children, next));
    }
  }
  return spans;
}

/** The language tag on a `pre` or its `code` child, if any. */
function codeBlockLanguage(
  pre: Extract<IHtmlNode, { type: 'tag' | 'script' | 'style' }>,
): string | undefined {
  const classes = [
    pre.attribs.class ?? '',
    ...pre.children.map((child) =>
      isElement(child) && child.name === 'code'
        ? (child.attribs.class ?? '')
        : '',
    ),
  ];
  for (const value of classes) {
    const match = CODE_LANGUAGE_CLASS_RE.exec(value);
    if (match) return match[1].toLowerCase();
  }
  return undefined;
}

export function parseDocumentBlocks(
  content: string,
  format: DocumentBlockFormat,
): IDocumentBlock[] {
  const html =
    format === 'markdown' ? marked.parser(marked.lexer(content)) : content;
  const root = parseDocument(html);
  const blocks: IDocumentBlock[] = [];
  const add = (
    kind: DocumentBlockKind,
    nodes: IHtmlNode[],
    extra: Partial<IDocumentBlock> = {},
  ) => {
    const spans = collectInline(nodes);
    if (spans.some((span) => span.text.trim())) {
      blocks.push({ kind, spans, ...extra });
    }
  };
  /**
   * A quote or list item: its text is one block, but code, tables, nested
   * lists and quotes inside it stay blocks of their own, so they keep their
   * kind (code is not read out as prose). Text on either side of such a
   * block becomes a separate block of the container's kind.
   */
  const addContainer = (
    kind: 'quote' | 'list',
    children: IHtmlNode[],
    depth: number,
    extra: Partial<IDocumentBlock>,
  ) => {
    let inline: IHtmlNode[] = [];
    const flush = () => {
      if (inline.length) add(kind, inline, extra);
      inline = [];
    };
    for (const child of children) {
      const name = isElement(child) ? child.name.toLowerCase() : '';
      if (name === 'ul' || name === 'ol') {
        flush();
        walk(isElement(child) ? child.children : [], depth + 1);
      } else if (CONTAINED_BLOCK_TAGS.has(name)) {
        flush();
        walk([child], depth);
      } else {
        inline.push(child);
      }
    }
    flush();
  };
  const walk = (nodes: IHtmlNode[], depth = 0) => {
    for (const node of nodes) {
      if (node.type === 'text') {
        if (node.data.trim()) {
          blocks.push({ kind: 'paragraph', spans: [{ text: node.data }] });
        }
        continue;
      }
      if (!isElement(node)) continue;
      const tag = node.name.toLowerCase();
      if (['script', 'style', 'head', 'noscript'].includes(tag)) continue;
      if (
        ['svg', 'canvas', 'iframe', 'video', 'audio'].includes(tag) ||
        INTERACTIVE_CLASS_RE.test(node.attribs.class ?? '')
      ) {
        blocks.push({
          kind: 'placeholder',
          placeholderOf: 'interactive',
          spans: [
            {
              text: 'Interactive content is available in the original document.',
            },
          ],
        });
      } else if (
        tag === 'pre' &&
        node.children.some(
          (child) =>
            isElement(child) &&
            MERMAID_CODE_CLASS_RE.test(child.attribs.class ?? ''),
        )
      ) {
        blocks.push({
          kind: 'placeholder',
          placeholderOf: 'diagram',
          spans: [{ text: 'Diagram is available in the original document.' }],
        });
      } else if (/^h[1-6]$/.test(tag)) {
        add('heading', node.children, { level: Number(tag[1]) });
      } else if (tag === 'p') {
        if (
          node.children.some(
            (child) => isElement(child) && child.name === 'img',
          )
        ) {
          walk(node.children, depth);
        } else {
          add('paragraph', node.children);
        }
      } else if (tag === 'blockquote') {
        addContainer('quote', node.children, depth, {});
      } else if (tag === 'pre') {
        const language = codeBlockLanguage(node);
        add('code', node.children, language ? { language } : {});
      } else if (tag === 'li') {
        addContainer('list', node.children, depth, { level: depth });
      } else if (tag === 'ul' || tag === 'ol') {
        walk(node.children, depth);
      } else if (tag === 'img') {
        blocks.push({
          kind: 'image',
          spans: [],
          imageUrl: node.attribs.src,
          alt: node.attribs.alt,
        });
      } else if (tag === 'tr') {
        const cells = node.children.filter(
          (child) => isElement(child) && ['td', 'th'].includes(child.name),
        );
        const spans = cells.flatMap((cell, index) => [
          ...(index ? [{ text: ' | ' }] : []),
          ...collectInline(isElement(cell) ? cell.children : []),
        ]);
        if (spans.length) blocks.push({ kind: 'table', spans });
      } else if (
        [
          'div',
          'section',
          'article',
          'main',
          'body',
          'html',
          'table',
          'thead',
          'tbody',
          'tfoot',
        ].includes(tag)
      ) {
        walk(node.children, depth);
      } else if (
        tag === 'a' ||
        tag === 'span' ||
        tag === 'strong' ||
        tag === 'em'
      ) {
        add('paragraph', [node]);
      } else {
        walk(node.children, depth);
      }
    }
  };
  walk(root.children);
  return blocks;
}

/** The block's visible text, spans joined. */
export function documentBlockText(block: IDocumentBlock): string {
  return block.spans.map((span) => span.text).join('');
}
