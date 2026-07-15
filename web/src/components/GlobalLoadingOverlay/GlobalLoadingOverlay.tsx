import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { selectIsLoading, selectLoadingMessage } from '../../store/slices/uiSlice';
import { Spinner } from '../ui/Spinner';

const OVERLAY_ID = 'sf-global-loading-overlay';

/**
 * Full-viewport loading blocker.
 *
 * Portaled to document.body with z-[1300] so it sits above:
 * - TopAppBar (z-[1100])
 * - Sidebar (z-[1200])
 * - Radix Dialog portals (z-50)
 * and below ToastContainer (z-[9999]).
 *
 * Rendering inside #root cannot cover portaled dialogs or high-z chrome.
 */
export const GlobalLoadingOverlay = () => {
  const isLoading = useSelector(selectIsLoading);
  const loadingMessage = useSelector(selectLoadingMessage);

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }

    // Portaled dialogs/overlays are siblings of #root (outside AppShell inert).
    // Mark every other body child inert so keyboard focus cannot reach them.
    // Leave #root (already inert-wrapped), this overlay, and toasts interactive.
    const marked: HTMLElement[] = [];
    Array.from(document.body.children).forEach((child) => {
      if (!(child instanceof HTMLElement)) {
        return;
      }
      if (child.id === 'root' || child.id === OVERLAY_ID) {
        return;
      }
      // ToastContainer portals with z-[9999]
      if (child.className.includes('z-[9999]')) {
        return;
      }
      child.setAttribute('inert', '');
      marked.push(child);
    });

    return () => {
      marked.forEach((el) => {
        el.removeAttribute('inert');
      });
    };
  }, [isLoading]);

  if (!isLoading || typeof document === 'undefined') {
    return null;
  }

  const message = loadingMessage ?? 'Working…';

  return createPortal(
    <div
      id={OVERLAY_ID}
      className="fixed inset-0 z-[1300] flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Spinner size="lg" variant="muted" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>,
    document.body
  );
};
