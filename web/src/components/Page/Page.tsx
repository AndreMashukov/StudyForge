import React from 'react';
import { cn } from '../../lib/utils';
import { IPage } from './IPage';
import { Sidebar } from '../Sidebar';

export const Page = ({ 
  children, 
  className, 
  showSidebar = true
}: IPage) => {
  return (
    <div className={cn("flex min-h-[calc(100vh-4rem)]", className)}>
      {/* Sidebar - always visible on left */}
      {showSidebar && <Sidebar />}

      {/* Main Content Area - adjusted for sidebar */}
      <div 
        className={cn(
          "flex-1 flex flex-col transition-all duration-300",
          "overflow-hidden"
        )}
      >
        {/* Main Content */}
        <main className={cn(
          "flex-1 p-6 overflow-y-auto",
          "scrollbar-thin scrollbar-track-muted scrollbar-thumb-muted-foreground"
        )}>
          {children}
        </main>
      </div>
    </div>
  );
};