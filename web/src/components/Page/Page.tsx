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

  // In app fullscreen mode, sidebar is hidden and no margin is applied
  const sidebarWidth = sidebarIsOpen ? 200 : 64;
  const leftMargin =
    !isMobile && showSidebar && !isAppFullscreen ? sidebarWidth : 0;

  return (
    <>
      {/* Render Sidebar only when not in fullscreen */}
      {showSidebar && !isAppFullscreen && <Sidebar />}

      {/* Main Content Area - adjusted for fixed sidebar */}
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
            'flex-1 overflow-y-auto',
            'p-0 md:p-6',
            'scrollbar-thin scrollbar-track-muted scrollbar-thumb-muted-foreground'
          )}
        >
          {children}
        </main>
      </div>
    </>
  );
};
