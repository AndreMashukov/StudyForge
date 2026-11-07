import { useEffect, useMemo } from 'react';
import {
  DocumentContentFormat,
  type IScratchPad,
  resolveDocumentContentFormat,
} from '@shared-types';
import { MarkdownRenderer, TocItem } from '../MarkdownRenderer';
import { DocumentHtmlContent } from '../DocumentHtmlContent';
import { extractBodyHtml } from '../../lib/document-html-enhance';

export interface IDocumentContentRenderer {
  content: string;
  contentFormat?: DocumentContentFormat;
  className?: string;
  showToc?: boolean;
  onTocGenerated?: (items: TocItem[]) => void;
  scratchPads?: IScratchPad[];
  onRegenerateScratchPad?: (sectionIndex: number) => Promise<void>;
  onClearScratchPadMemory?: (sectionIndex: number) => Promise<void>;
  onEvaluateScratchPad?: (
    sectionIndex: number,
    userAnswer: string,
  ) => Promise<{ score: number; hint?: string }>;
}

function generateHtmlToc(content: string): TocItem[] {
  const body = extractBodyHtml(content);
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings: TocItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(body)) !== null) {
    const level = Number.parseInt(match[1], 10);
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    const id = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    headings.push({ id, title, level, children: [] });
  }

  return headings;
}

export function DocumentContentRenderer({
  content,
  contentFormat,
  className,
  showToc = true,
  onTocGenerated,
  scratchPads,
  onRegenerateScratchPad,
  onClearScratchPadMemory,
  onEvaluateScratchPad,
}: IDocumentContentRenderer) {
  const format = resolveDocumentContentFormat(contentFormat);
  const bodyHtml = useMemo(
    () => (format === 'html' ? extractBodyHtml(content) : ''),
    [content, format]
  );
  const htmlToc = useMemo(
    () => (format === 'html' && showToc ? generateHtmlToc(content) : []),
    [content, format, showToc]
  );

  useEffect(() => {
    if (format !== 'html' || !showToc || !onTocGenerated) {
      return;
    }
    onTocGenerated(htmlToc);
  }, [format, showToc, onTocGenerated, htmlToc]);

  if (format === 'html') {
    return (
      <DocumentHtmlContent
        html={bodyHtml}
        className={className}
        scratchPads={scratchPads}
        onRegenerateScratchPad={onRegenerateScratchPad}
        onClearScratchPadMemory={onClearScratchPadMemory}
        onEvaluateScratchPad={onEvaluateScratchPad}
      />
    );
  }

  return (
    <MarkdownRenderer
      content={content}
      className={className}
      showToc={showToc}
      onTocGenerated={onTocGenerated}
    />
  );
}
