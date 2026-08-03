import { memo, useMemo } from 'react';
import { MermaidDiagram } from '../MermaidDiagram';
import { CodeBlock } from '../MarkdownRenderer/CodeBlock/CodeBlock';
import { HtmlWithMath } from './HtmlWithMath';
import { PlotlyGraph } from './PlotlyGraph';
import { splitCollapsibleSections } from '../../lib/document-html-enhance';
import { cn } from '../../lib/utils';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

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
    } else if (language === 'plotly' || language === 'graph') {
      segments.push({ type: 'plotly', code });
    } else {
      segments.push({ type: 'code', language, code });
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
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="my-4 rounded-lg border border-border">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left font-medium"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{title}</span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
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
          return <MermaidDiagram key={key} code={segment.code} />;
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
}: {
  html: string;
  className?: string;
}) {
  const sections = useMemo(() => splitCollapsibleSections(html), [html]);

  if (!html.trim()) {
    return null;
  }

  return (
    <div className={cn('document-html-content space-y-4 prose prose-invert max-w-none', className)}>
      {sections.map((section, index) => {
        const keyPrefix = `section-${index}`;
        const body = <DocumentSegmentList html={section.html} keyPrefix={keyPrefix} />;

        if (section.kind === 'collapse' && section.title) {
          return (
            <CollapsibleDocSection key={keyPrefix} title={section.title}>
              {body}
            </CollapsibleDocSection>
          );
        }

        return <div key={keyPrefix}>{body}</div>;
      })}
    </div>
  );
});
