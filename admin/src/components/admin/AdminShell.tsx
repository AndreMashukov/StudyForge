'use client';

import * as React from 'react';
import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';

export interface IAdminShellProps {
  children: React.ReactNode;
  email?: string;
}

export function AdminShell({ children, email }: IAdminShellProps) {
  const [sidebarIsOpen, setSidebarIsOpen] = React.useState(true);
  const sidebarWidth = sidebarIsOpen ? 220 : 64;

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <AdminHeader onToggleSidebar={() => setSidebarIsOpen((isOpen) => !isOpen)} />
      <AdminSidebar email={email} isOpen={sidebarIsOpen} />
      <div
        className="flex h-[calc(100vh-48px)] flex-col transition-all duration-300"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <main className="flex-1 overflow-y-auto px-0 pb-0 md:px-6 md:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}
