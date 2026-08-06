'use client';

import { UiStoreProvider, useUiStore } from '@admin/providers/ui-store-provider';
import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';

export interface IAdminShellProps {
  children: React.ReactNode;
  email?: string;
}

function AdminShellFrame({ children, email }: IAdminShellProps) {
  const sidebarIsOpen = useUiStore((state) => state.sidebarOpen);
  const sidebarWidth = sidebarIsOpen ? 220 : 64;

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <AdminHeader />
      <AdminSidebar email={email} />
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

export function AdminShell({ children, email }: IAdminShellProps) {
  return (
    <UiStoreProvider>
      <AdminShellFrame email={email}>{children}</AdminShellFrame>
    </UiStoreProvider>
  );
}
