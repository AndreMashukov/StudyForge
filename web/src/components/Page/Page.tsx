import React from 'react';
import { useSelector } from 'react-redux';
import { cn } from '../../lib/utils';
import { IPage } from './IPage';
import { Sidebar } from '../Sidebar';
import { selectSidebarIsOpen } from '../../store/slices/uiSlice';

export const Page = ({ 
  children, 
  className, 
  showSidebar = true
}: IPage) => {
  const sidebarIsOpen = useSelector(selectSidebarIsOpen);
  const [isMobile, setIsMobile] = React.useState(false);
  
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Calculate left margin based on sidebar state (only on desktop)
  const sidebarWidth = sidebarIsOpen ? 200 : 64;
  const leftMargin = !isMobile && showSidebar ? sidebarWidth : 0;

  return (
    <>
      {/* Render Sidebar if needed */}
      {showSidebar && <Sidebar />}

      {/* Main Content Area - adjusted for fixed sidebar */}
      <div 
        className={cn(
          "flex flex-col min-h-screen transition-all duration-300",
          className
        )}
        style={{
          marginLeft: `${leftMargin}px`,
        }}
      >
        {/* Main Content */}
        <main className={cn(
          "flex-1 overflow-y-auto",
          "p-0 md:p-6",
          "scrollbar-thin scrollbar-track-muted scrollbar-thumb-muted-foreground"
        )}>
          {children}
        </main>
      </div>
    </>
  );
};