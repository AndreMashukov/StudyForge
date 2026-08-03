export type DocHtmlSection = {
  kind: 'plain' | 'collapse';
  title?: string;
  html: string;
};

const COLLAPSIBLE_TITLE_RE = /^(glossary|examples)\b/i;
const H2_SPLIT_RE = /(<h2\b[^>]*>[\s\S]*?<\/h2>)/gi;
const H2_TITLE_RE = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i;

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function wrapTablesInHtml(html: string): string {
  return html.replace(/<table\b[\s\S]*?<\/table>/gi, (table) => {
    if (table.includes('document-table-wrap')) {
      return table;
    }
    return `<div class="document-table-wrap overflow-x-auto my-4">${table}</div>`;
  });
}

export function splitCollapsibleSections(html: string): DocHtmlSection[] {
  if (!html.trim()) {
    return [];
  }

  const tokens = html.split(H2_SPLIT_RE);
  const sections: DocHtmlSection[] = [];
  let plainBuffer = '';
  let pendingCollapseTitle: string | null = null;

  const flushPendingCollapse = () => {
    if (!pendingCollapseTitle) {
      return;
    }
    sections.push({
      kind: 'collapse',
      title: pendingCollapseTitle,
      html: wrapTablesInHtml(plainBuffer),
    });
    pendingCollapseTitle = null;
    plainBuffer = '';
  };

  const flushPlainBuffer = () => {
    const wrapped = wrapTablesInHtml(plainBuffer);
    if (wrapped.trim()) {
      sections.push({ kind: 'plain', html: wrapped });
    }
    plainBuffer = '';
  };

  for (const token of tokens) {
    if (!token) {
      continue;
    }

    const headingMatch = token.match(H2_TITLE_RE);
    if (headingMatch) {
      const title = stripTags(headingMatch[1] ?? '');
      if (COLLAPSIBLE_TITLE_RE.test(title)) {
        if (pendingCollapseTitle) {
          flushPendingCollapse();
        } else {
          flushPlainBuffer();
        }
        pendingCollapseTitle = title;
        continue;
      }

      if (pendingCollapseTitle) {
        flushPendingCollapse();
      }
      plainBuffer += token;
      continue;
    }

    plainBuffer += token;
  }

  if (pendingCollapseTitle) {
    flushPendingCollapse();
  } else {
    flushPlainBuffer();
  }

  return sections.length > 0 ? sections : [{ kind: 'plain', html: wrapTablesInHtml(html) }];
}

export function extractBodyHtml(fullHtml: string): string {
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) {
    return bodyMatch[1].trim();
  }
  return fullHtml.trim();
}
