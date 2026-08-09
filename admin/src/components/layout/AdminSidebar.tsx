'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Brain,
  Cable,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  SlidersHorizontal,
  Users,
  UsersRound,
} from 'lucide-react';
import {
  Sidebar,
  SidebarNav,
  SidebarNavItem,
  SidebarProfileFooter,
  SidebarSection,
  cn,
  sidebarClassNames,
} from '@study-forge/ui';
import { deleteAdminSession } from '@admin/mutations/auth';
import { useUiStore } from '@admin/providers/ui-store-provider';
import { AdminNavLinkContent } from './AdminNavLinkContent';

const platformNavItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/user-groups', label: 'User groups', icon: UsersRound },
  { href: '/documents', label: 'Documents', icon: FileText },
];

const aiNavItems = [
  { href: '/llm-setups', label: 'LLM setups', icon: Brain },
  { href: '/generation-settings', label: 'Generation settings', icon: SlidersHorizontal },
  { href: '/usage-limits-setups', label: 'Usage limits', icon: Gauge },
  { href: '/provider-connections', label: 'Provider connections', icon: Cable },
];

export interface IAdminSidebarProps {
  email?: string;
}

export function AdminSidebar({ email }: IAdminSidebarProps) {
  const currentPath = usePathname();
  const router = useRouter();
  const sidebarIsOpen = useUiStore((state) => state.sidebarOpen);

  const handleLogout = async () => {
    await deleteAdminSession();
    router.push('/login');
    router.refresh();
  };

  const displayEmail = email ?? 'admin';

  const renderNavItems = (items: typeof platformNavItems) =>
    items.map(({ href, label, icon: Icon }) => {
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
            !sidebarIsOpen && 'justify-center relative group',
            isActive && sidebarClassNames.navItemActive
          )}
        >
          <Link href={href} aria-current={isActive ? 'page' : undefined}>
            <AdminNavLinkContent label={label} icon={Icon} isOpen={sidebarIsOpen} />
          </Link>
        </SidebarNavItem>
      );
    });

  return (
    <Sidebar
      className={cn(
        sidebarClassNames.container,
        sidebarIsOpen ? sidebarClassNames.expanded : sidebarClassNames.collapsed
      )}
      footer={
        <SidebarProfileFooter
          avatarLabel={displayEmail.charAt(0).toUpperCase()}
          primaryText={displayEmail}
          secondaryText="Admin plan"
          isOpen={sidebarIsOpen}
          action={
            <button
              className={cn(
                sidebarClassNames.footerAction,
                !sidebarIsOpen && 'relative group justify-center p-0'
              )}
              onClick={handleLogout}
              aria-label="Sign out"
            >
              <LogOut
                size={sidebarIsOpen ? 14 : 16}
                className={sidebarClassNames.navItemIcon}
              />
              {!sidebarIsOpen ? (
                <div className={sidebarClassNames.collapsedTooltip}>Sign out</div>
              ) : null}
            </button>
          }
        />
      }
      aria-label="Admin navigation"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-hidden">
        <SidebarSection label="Platform" isOpen={sidebarIsOpen}>
          <SidebarNav className={sidebarClassNames.navList} aria-label="Platform navigation">
            {renderNavItems(platformNavItems)}
          </SidebarNav>
        </SidebarSection>

        <SidebarSection label="AI" isOpen={sidebarIsOpen}>
          <SidebarNav className={sidebarClassNames.navList} aria-label="AI navigation">
            {renderNavItems(aiNavItems)}
          </SidebarNav>
        </SidebarSection>
      </div>
    </Sidebar>
  );
}
