'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FileText, LayoutDashboard, LogOut, SlidersHorizontal, Users } from 'lucide-react';
import {
  Sidebar,
  SidebarNav,
  SidebarNavItem,
  SidebarProfileFooter,
  SidebarSection,
  cn,
  sidebarClassNames,
} from '@study-forge/ui';
import { AdminNavLinkContent } from './AdminNavLinkContent';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/model-settings', label: 'Model Settings', icon: SlidersHorizontal },
];

export interface IAdminSidebarProps {
  email?: string;
  isOpen: boolean;
}

export function AdminSidebar({ email, isOpen }: IAdminSidebarProps) {
  const currentPath = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  const displayEmail = email ?? 'admin';

  return (
    <Sidebar
      className={cn(
        sidebarClassNames.container,
        isOpen ? sidebarClassNames.expanded : sidebarClassNames.collapsed
      )}
      footer={
        <SidebarProfileFooter
          avatarLabel={displayEmail.charAt(0).toUpperCase()}
          primaryText={displayEmail}
          secondaryText="Admin plan"
          isOpen={isOpen}
          action={
            <button
              className={cn(
                sidebarClassNames.footerAction,
                !isOpen && 'relative group justify-center p-0'
              )}
              onClick={handleLogout}
              aria-label="Sign out"
            >
              <LogOut
                size={isOpen ? 14 : 16}
                className={sidebarClassNames.navItemIcon}
              />
              {!isOpen ? (
                <div className={sidebarClassNames.collapsedTooltip}>
                  Sign out
                </div>
              ) : null}
            </button>
          }
        />
      }
      aria-label="Admin navigation"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-hidden">
        <SidebarSection label="Navigation" isOpen={isOpen}>
          <SidebarNav
            className={sidebarClassNames.navList}
            aria-label="Admin navigation"
          >
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive =
                href === '/'
                  ? currentPath === '/'
                  : currentPath === href || currentPath.startsWith(`${href}/`);

              return (
                <SidebarNavItem
                  key={href}
                  isActive={isActive}
                  asChild
                  className={cn(
                    !isOpen && 'justify-center relative group',
                    isActive && sidebarClassNames.navItemActive
                  )}
                >
                  <Link
                    href={href}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <AdminNavLinkContent
                      label={label}
                      icon={Icon}
                      isOpen={isOpen}
                    />
                  </Link>
                </SidebarNavItem>
              );
            })}
          </SidebarNav>
        </SidebarSection>
      </div>
    </Sidebar>
  );
}
