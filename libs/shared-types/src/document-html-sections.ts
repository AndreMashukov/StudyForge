const COLLAPSIBLE_TITLE_RE = /^(glossary|examples)\b/i;
const H2_SPLIT_RE = /(<h2\b[^>]*>[\s\S]*?<\/h2>)/gi;
const H2_TITLE_RE = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i;

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** Lesson body chunk used for scratch pad generation and regeneration. */
export interface ILessonSection {
  sectionIndex: number;
  heading: string;
  html: string;
}

export type IDocumentHtmlRenderSection =
  | { kind: 'leadIn'; html: string }
  | { kind: 'lesson'; sectionIndex: number; heading: string; html: string }
  | { kind: 'collapse'; title: string; html: string };

function wrapTablesInHtml(html: string): string {
  return html.replace(/<table\b[\s\S]*?<\/table>/gi, (table) => {
    if (table.includes('document-table-wrap')) {
      return table;
    }
    return `<div class="document-table-wrap">${table}</div>`;
  });
}

/** Split HTML into lesson h2 sections (excludes lead-in and Glossary/Examples). */
export function splitLessonH2Sections(html: string): ILessonSection[] {
  if (!html.trim()) {
    return [];
  }

  const tokens = html.split(H2_SPLIT_RE);
  const sections: ILessonSection[] = [];
  let sectionIndex = 0;
  let seenFirstH2 = false;
  let currentLesson: { heading: string; html: string } | null = null;

  const flushLesson = () => {
    if (currentLesson && currentLesson.html.trim()) {
      sections.push({
        sectionIndex,
        heading: currentLesson.heading,
        html: wrapTablesInHtml(currentLesson.html),
      });
      sectionIndex += 1;
    }
    currentLesson = null;
  };

  for (const token of tokens) {
    if (!token) {
      continue;
    }

    const headingMatch = token.match(H2_TITLE_RE);
    if (headingMatch) {
      seenFirstH2 = true;
      const title = stripTags(headingMatch[1] ?? '');
      flushLesson();
      if (COLLAPSIBLE_TITLE_RE.test(title)) {
        currentLesson = null;
        continue;
      }
      currentLesson = { heading: title, html: token };
      continue;
    }

    if (!seenFirstH2) {
      continue;
    }

    if (currentLesson) {
      currentLesson.html += token;
    }
  }

  flushLesson();
  return sections;
}

/** Viewer-oriented split: lead-in, per-lesson h2 blocks, and collapsible reference sections. */
export function splitDocumentHtmlRenderSections(
  html: string,
): IDocumentHtmlRenderSection[] {
  if (!html.trim()) {
    return [];
  }

  const tokens = html.split(H2_SPLIT_RE);
  const sections: IDocumentHtmlRenderSection[] = [];
  let leadInBuffer = '';
  let lessonSectionIndex = 0;
  let currentLesson: {
    heading: string;
    html: string;
  } | null = null;
  let pendingCollapseTitle: string | null = null;
  let collapseBuffer = '';
  let seenFirstH2 = false;

  const flushLeadIn = () => {
    const wrapped = wrapTablesInHtml(leadInBuffer);
    if (wrapped.trim()) {
      sections.push({ kind: 'leadIn', html: wrapped });
    }
    leadInBuffer = '';
  };

  const flushLesson = () => {
    if (currentLesson && currentLesson.html.trim()) {
      sections.push({
        kind: 'lesson',
        sectionIndex: lessonSectionIndex,
        heading: currentLesson.heading,
        html: wrapTablesInHtml(currentLesson.html),
      });
      lessonSectionIndex += 1;
    }
    currentLesson = null;
  };

  const flushCollapse = () => {
    if (!pendingCollapseTitle) {
      return;
    }
    const wrapped = wrapTablesInHtml(collapseBuffer);
    if (wrapped.trim() || pendingCollapseTitle) {
      sections.push({
        kind: 'collapse',
        title: pendingCollapseTitle,
        html: wrapped,
      });
    }
    pendingCollapseTitle = null;
    collapseBuffer = '';
  };

  for (const token of tokens) {
    if (!token) {
      continue;
    }

    const headingMatch = token.match(H2_TITLE_RE);
    if (headingMatch) {
      seenFirstH2 = true;
      const title = stripTags(headingMatch[1] ?? '');

      if (COLLAPSIBLE_TITLE_RE.test(title)) {
        flushLesson();
        if (pendingCollapseTitle) {
          flushCollapse();
        } else if (!currentLesson && !pendingCollapseTitle) {
          flushLeadIn();
        }
        pendingCollapseTitle = title;
        continue;
      }

      if (pendingCollapseTitle) {
        flushCollapse();
      }
      flushLesson();
      if (!sections.some((s) => s.kind === 'leadIn' || s.kind === 'lesson')) {
        flushLeadIn();
      }
      currentLesson = { heading: title, html: token };
      continue;
    }

    if (!seenFirstH2) {
      leadInBuffer += token;
      continue;
    }

    if (pendingCollapseTitle) {
      collapseBuffer += token;
      continue;
    }

    if (currentLesson) {
      currentLesson.html += token;
    }
  }

  flushLesson();
  if (pendingCollapseTitle) {
    flushCollapse();
  } else {
    flushLeadIn();
  }

  return sections.length > 0
    ? sections
    : [{ kind: 'leadIn', html: wrapTablesInHtml(html) }];
}
