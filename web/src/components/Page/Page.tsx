import React from 'react';
import { useSelector } from 'react-redux';
import { cn } from '../../lib/utils';
import { IPage } from './IPage';
import { Sidebar } from '../Sidebar';
import { selectSidebarIsOpen } from '../../store/slices/uiSlice';
import { useAppFullscreen } from '../../contexts/FullscreenContext';

export const Page = ({ children, className, showSidebar = true }: IPage) => {
  const sidebarIsOpen = useSelector(selectSidebarIsOpen);
  const { isAppFullscreen } = useAppFullscreen();
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sidebar width: expanded 220px, collapsed 64px
  const sidebarWidth = sidebarIsOpen ? 220 : 64;
  const leftMargin =
    !isMobile && showSidebar && !isAppFullscreen ? sidebarWidth : 0;

  return (
    <>
      {/* Render Sidebar only when not in fullscreen */}
      {showSidebar && !isAppFullscreen && <Sidebar />}

      {/* Main Content Area - adjusted for sidebar left margin */}
      <div
        className={cn(
          'flex flex-col flex-1 min-h-0 transition-all duration-300',
          className
        )}
        style={{
          marginLeft: `${leftMargin}px`,
        }}
      >
        {/* Main Content */}
        <main
          className={cn(
            // Direct children need w-full so max-w-* mx-auto pages don't shrink
            // to content width once this main is a flex column.
            'flex flex-1 min-h-0 flex-col overflow-y-auto overscroll-contain',
            '[&>*:not(.fixed)]:w-full',
            'px-0 pb-0 md:px-6 md:pb-6',
            'scrollbar-thin scrollbar-track-muted scrollbar-thumb-muted-foreground'
          )}
        >
          {children}
        </main>
      </div>
    </>
  );
};
