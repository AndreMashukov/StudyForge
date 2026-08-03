import sanitizeHtml from 'sanitize-html';
import { ALLOWED_HTML_TAGS } from '@shared-types';
import type { DocumentContentFormat } from '@shared-types';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...ALLOWED_HTML_TAGS],
  allowedAttributes: {
    a: ['href', 'title'],
    code: ['class'],
    pre: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    a: ['http', 'https', 'mailto'],
  },
  allowProtocolRelative: false,
};

export function buildDocumentHtmlStoragePath(userId: string, documentId: string): string {
  return `users/${userId}/documents/${documentId}/content.html`;
}

export function buildDocumentMarkdownStoragePath(userId: string, documentId: string): string {
  return `users/${userId}/documents/${documentId}/content.md`;
}

export function resolveDocumentStoragePath(
  userId: string,
  documentId: string,
  contentFormat: DocumentContentFormat
): string {
  return contentFormat === 'html'
    ? buildDocumentHtmlStoragePath(userId, documentId)
    : buildDocumentMarkdownStoragePath(userId, documentId);
}

export function normalizeGeneratedHtml(content: string): string {
  const stripped = content
    .replace(/^```(?:html|markdown)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  if (!stripped) {
    return '';
  }

  if (/<[a-z][\s\S]*>/i.test(stripped)) {
    return sanitizeHtml(stripped, SANITIZE_OPTIONS).trim();
  }

  const escaped = stripped
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return escaped
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${block.replace(/\n/g, '<br />')}</p>`)
    .join('\n');
}

export function wrapHtmlDocument(bodyHtml: string, title = 'Document'): string {
  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n<title>${safeTitle}</title>\n</head>\n<body>\n${bodyHtml}\n</body>\n</html>`;
}

export function extractBodyHtml(fullHtml: string): string {
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) {
    return bodyMatch[1].trim();
  }
  return fullHtml.trim();
}

export function extractHtmlTitle(html: string): string | null {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match?.[1]) {
    return stripHtmlTags(h1Match[1]).trim() || null;
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    return stripHtmlTags(titleMatch[1]).trim() || null;
  }

  return null;
}

export function extractMarkdownTitle(content: string): string | null {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  return titleMatch?.[1]?.trim() || null;
}

export function extractDocumentTitle(
  content: string,
  contentFormat: DocumentContentFormat
): string | null {
  if (contentFormat === 'html') {
    const body = extractBodyHtml(content);
    return extractHtmlTitle(body) ?? extractHtmlTitle(content);
  }
  return extractMarkdownTitle(content);
}

export function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function htmlToReadableText(html: string): string {
  const body = extractBodyHtml(html);
  const withCodeBlocks = body.replace(
    /<pre>\s*<code[^>]*class=["'][^"']*language-mermaid[^"']*["'][^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_match, code: string) => `\n[Mermaid diagram]\n${stripHtmlTags(code)}\n`
  );

  const withPlotly = withCodeBlocks.replace(
    /<pre>\s*<code[^>]*class=["'][^"']*language-(?:plotly|graph)[^"']*["'][^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    () => '\n[Plotly chart]\n'
  );

  const withHeadings = withPlotly
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level: string, text: string) => {
      const hashes = '#'.repeat(Number.parseInt(level, 10));
      return `\n${hashes} ${stripHtmlTags(text)}\n`;
    })
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_match, text: string) => `- ${stripHtmlTags(text)}\n`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n');

  return stripHtmlTags(withHeadings);
}

export function countWordsFromContent(content: string, contentFormat: DocumentContentFormat): number {
  const text =
    contentFormat === 'html'
      ? htmlToReadableText(content)
      : content.trim().replace(/\s+/g, ' ');

  if (!text.trim()) {
    return 0;
  }

  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

export function adaptDocumentContentForLlm(
  content: string,
  contentFormat: DocumentContentFormat | undefined
): string {
  const format = contentFormat ?? 'markdown';
  if (format === 'html') {
    return htmlToReadableText(content);
  }
  return content;
}
