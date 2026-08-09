import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { FileText, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { selectSidebarIsOpen } from '../../store/slices/uiSlice';
import { useAppFullscreen } from '../../contexts/FullscreenContext';
import { useTrackOpenModal } from '../ModalVisibility';
import { ICreateDocumentModalProps } from './ICreateDocumentModal';
import { CreateDocumentModalProvider } from './CreateDocumentModalProvider';
import { CreateDocumentModalContent } from './CreateDocumentModalContent';

/** Matches TopAppBar `h-12` and Sidebar `top-12`. */
const APP_BAR_HEIGHT_PX = 48;
/** Matches Page / Sidebar expanded & collapsed widths. */
const SIDEBAR_EXPANDED_PX = 220;
const SIDEBAR_COLLAPSED_PX = 64;
const PAGE_WIDE_GAP_PX = 16;

export const CreateDocumentModal: React.FC<ICreateDocumentModalProps> = ({
  open,
  directoryId,
  onClose,
  onRequestStarted,
}) => {
  const sidebarIsOpen = useSelector(selectSidebarIsOpen);
  const { isAppFullscreen } = useAppFullscreen();
  const [isMobile, setIsMobile] = useState(false);

  useTrackOpenModal(open);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const pageWideStyle = useMemo(() => {
    const sidebarWidth = sidebarIsOpen ? SIDEBAR_EXPANDED_PX : SIDEBAR_COLLAPSED_PX;
    const contentLeft = !isMobile && !isAppFullscreen ? sidebarWidth : 0;
    const contentTop = isAppFullscreen ? 0 : APP_BAR_HEIGHT_PX;
    return {
      top: contentTop + PAGE_WIDE_GAP_PX,
      left: contentLeft + PAGE_WIDE_GAP_PX,
      right: PAGE_WIDE_GAP_PX,
      bottom: PAGE_WIDE_GAP_PX,
    };
  }, [isAppFullscreen, isMobile, sidebarIsOpen]);

  if (!open || !directoryId) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden
      />

      <section
        className={cn(
          'fixed z-50 flex flex-col overflow-hidden rounded-lg border border-border bg-background/95 shadow-2xl backdrop-blur',
        )}
        style={pageWideStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Create document"
      >
        <CreateDocumentModalProvider
          open={open}
          directoryId={directoryId}
          onRequestStarted={onRequestStarted}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileText size={18} className="shrink-0 text-primary" />
                <h2 className="truncate text-base font-semibold">Create Document</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a source type and configure your document
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onClose}
              aria-label="Close create document modal"
            >
              <X size={16} />
            </Button>
          </div>

          <CreateDocumentModalContent />
        </CreateDocumentModalProvider>
      </section>
    </>
  );
};
