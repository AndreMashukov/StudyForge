import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Walk up from `element` to find the nearest ancestor that scrolls vertically.
 * StudyForge pages scroll inside `<Page>`'s `<main>`, not the browser window.
 */
export function findNearestScrollParent(element: HTMLElement | null): HTMLElement | null {
  let node = element?.parentElement ?? null;

  while (node && node !== document.body && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return node;
    }
    node = node.parentElement;
  }

  return null;
}

export function measureScrollMargin(
  element: HTMLElement,
  scrollParent: HTMLElement,
): number {
  const elementRect = element.getBoundingClientRect();
  const parentRect = scrollParent.getBoundingClientRect();
  return elementRect.top - parentRect.top + scrollParent.scrollTop;
}

/**
 * Resolve the layout scroll parent + list offset for page-level virtualization.
 * `scrollMode="window"` in VirtualizedList/Grid uses this instead of the real window.
 */
export function useNearestScrollParent(
  elementRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  remountKey?: unknown,
): { scrollElement: HTMLElement | null; scrollMargin: number } {
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (!enabled) {
      setScrollElement(null);
      setScrollMargin(0);
      return;
    }

    const element = elementRef.current;
    if (!element) {
      return;
    }

    const update = () => {
      const parent = findNearestScrollParent(element);
      setScrollElement(parent);
      if (parent) {
        setScrollMargin(measureScrollMargin(element, parent));
      } else {
        setScrollMargin(0);
      }
    };

    update();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    resizeObserver?.observe(element);

    const parent = findNearestScrollParent(element);
    if (parent) {
      resizeObserver?.observe(parent);
    }

    window.addEventListener('resize', update);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [enabled, remountKey, elementRef]);

  return { scrollElement, scrollMargin };
}
