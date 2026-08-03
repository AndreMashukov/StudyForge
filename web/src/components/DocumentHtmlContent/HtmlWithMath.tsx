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

    const tableWraps = Array.from(
      element.querySelectorAll<HTMLElement>('.document-table-wrap')
    );
    const updateTableOverflow = () => {
      tableWraps.forEach((wrap) => {
        wrap.classList.toggle(
          'is-overflowing',
          wrap.scrollWidth > wrap.clientWidth + 1
        );
      });
    };
    updateTableOverflow();

    const resizeObserver = new ResizeObserver(updateTableOverflow);
    tableWraps.forEach((wrap) => {
      resizeObserver.observe(wrap);
    });

    return () => {
      resizeObserver.disconnect();
    };
  }, [html]);

  return <div ref={containerRef} className={cn(className)} />;
});
