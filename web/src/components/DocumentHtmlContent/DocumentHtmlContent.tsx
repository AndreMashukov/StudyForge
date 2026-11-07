import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { IScratchPad } from '@shared-types';
import { splitDocumentHtmlRenderSections } from '@shared-types';
import { MermaidDiagram } from '../MermaidDiagram';
import { CodeBlock } from '../MarkdownRenderer/CodeBlock/CodeBlock';
import { HtmlWithMath } from './HtmlWithMath';
import { PlotlyGraph } from './PlotlyGraph';
import { DocumentScratchPadBox } from './DocumentScratchPadBox';
import { cn } from '../../lib/utils';
import { ChevronDown } from 'lucide-react';

type HtmlSegment = { type: 'html'; html: string };
type CodeSegment = { type: 'code'; code: string; language: string };
type MermaidSegment = { type: 'mermaid'; code: string };
type PlotlySegment = { type: 'plotly'; code: string };
type Segment = HtmlSegment | CodeSegment | MermaidSegment | PlotlySegment;

const PRE_CODE_RE =
  /<pre\b[^>]*>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi;

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractLanguage(attrs: string): string {
  const match = /language-([\w+-]+)/i.exec(attrs);
  return match?.[1]?.toLowerCase() ?? 'text';
}

function sectionSlug(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function sectionStorageKey(title: string) {
  return `doc-section-open:${sectionSlug(title)}`;
}

export function splitHtmlByCodeBlocks(html: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  const re = new RegExp(PRE_CODE_RE.source, PRE_CODE_RE.flags);

  for (const match of html.matchAll(re)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: 'html', html: html.slice(lastIndex, index) });
    }

    const language = extractLanguage(match[1] ?? '');
    const code = decodeBasicEntities(match[2] ?? '').replace(/\n$/, '');

    if (language === 'mermaid') {
      segments.push({ type: 'mermaid', code });
    } else if (language === 'plotly') {
      segments.push({ type: 'plotly', code });
    } else {
      segments.push({ type: 'code', code, language });
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < html.length) {
    segments.push({ type: 'html', html: html.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'html', html }];
}

function CollapsibleDocSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const normalized = title.trim().toLowerCase();
  const contentId = `doc-section-${sectionSlug(title) || 'section'}`;
  const storageKey = sectionStorageKey(title);
  const [open, setOpen] = useState(normalized === 'glossary' ? false : true);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(storageKey);
    if (stored === '1') {
      setOpen(true);
    } else if (stored === '0') {
      setOpen(false);
    }
  }, [storageKey]);

  const handleToggle = () => {
    setOpen((current) => {
      const next = !current;
      window.sessionStorage.setItem(storageKey, next ? '1' : '0');
      return next;
    });
  };

  return (
    <section
      className={cn(
        'document-section-collapse',
        normalized === 'glossary' && 'is-glossary'
      )}
      data-section={normalized}
    >
      <button
        type="button"
        className="document-section-summary"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={handleToggle}
      >
        <span className="document-section-summary-title">{title}</span>
        <span className="document-section-summary-meta">
          <span>{open ? 'Collapse' : 'Expand'}</span>
          <ChevronDown
            size={16}
            className={cn('document-section-chevron', open && 'is-open')}
            aria-hidden
          />
        </span>
      </button>
      <div
        id={contentId}
        className={cn('document-section-body', !open && 'is-collapsed')}
        hidden={!open}
      >
        {children}
      </div>
    </section>
  );
}

function DocumentSegmentList({
  html,
  keyPrefix,
}: {
  html: string;
  keyPrefix: string;
}) {
  const segments = useMemo(() => splitHtmlByCodeBlocks(html), [html]);

  return (
    <>
      {segments.map((segment, index) => {
        const key = `${keyPrefix}-${index}`;

        if (segment.type === 'mermaid') {
          return (
            <MermaidDiagram
              key={key}
              code={segment.code}
              enableWheelZoom={false}
            />
          );
        }

        if (segment.type === 'plotly') {
          return <PlotlyGraph key={key} code={segment.code} />;
        }

        if (segment.type === 'code') {
          return (
            <CodeBlock key={key} language={segment.language} code={segment.code} />
          );
        }

        if (!segment.html.trim()) {
          return null;
        }

        return <HtmlWithMath key={key} html={segment.html} />;
      })}
    </>
  );
}

export const DocumentHtmlContent = memo(function DocumentHtmlContent({
  html,
  className,
  scratchPads,
  onRegenerateScratchPad,
  onClearScratchPadMemory,
  onEvaluateScratchPad,
}: {
  html: string;
  className?: string;
  scratchPads?: IScratchPad[];
  onRegenerateScratchPad?: (sectionIndex: number) => Promise<void>;
  onClearScratchPadMemory?: (sectionIndex: number) => Promise<void>;
  onEvaluateScratchPad?: (
    sectionIndex: number,
    userAnswer: string,
  ) => Promise<{ score: number; hint?: string }>;
}) {
  const sections = useMemo(() => splitDocumentHtmlRenderSections(html), [html]);
  const padBySection = useMemo(() => {
    const map = new Map<number, IScratchPad>();
    for (const pad of scratchPads ?? []) {
      map.set(pad.sectionIndex, pad);
    }
    return map;
  }, [scratchPads]);

  if (!html.trim()) {
    return null;
  }

  return (
    <div className={cn('document-html-content', className)}>
      {sections.map((section, index) => {
        const keyPrefix = `section-${index}`;
        const body = <DocumentSegmentList html={section.html} keyPrefix={keyPrefix} />;
        const pad =
          section.kind === 'lesson' ? padBySection.get(section.sectionIndex) : undefined;

        if (section.kind === 'collapse') {
          return (
            <CollapsibleDocSection key={keyPrefix} title={section.title}>
              {body}
            </CollapsibleDocSection>
          );
        }

        if (section.kind === 'lesson') {
          return (
            <div key={keyPrefix}>
              {body}
              {pad ? (
                <DocumentScratchPadBox
                  pad={pad}
                  onRegenerate={onRegenerateScratchPad}
                  onClearMemory={onClearScratchPadMemory}
                  onEvaluate={onEvaluateScratchPad}
                />
              ) : null}
            </div>
          );
        }

        return <div key={keyPrefix}>{body}</div>;
      })}
    </div>
  );
});
