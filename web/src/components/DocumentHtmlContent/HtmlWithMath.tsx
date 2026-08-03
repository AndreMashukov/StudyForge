import { memo, useLayoutEffect, useRef } from 'react';
import { renderMathInHtmlElement } from '../../lib/render-math';
import { cn } from '../../lib/utils';
import 'katex/dist/katex.min.css';

export const HtmlWithMath = memo(function HtmlWithMath({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    element.innerHTML = html;
    renderMathInHtmlElement(element);
  }, [html]);

  return <div ref={containerRef} className={cn('document-html-content', className)} />;
});
