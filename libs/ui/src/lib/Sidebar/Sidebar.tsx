'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../utils';
import {
  type ISidebar,
  type ISidebarNav,
  type ISidebarNavItem,
  type ISidebarProfileFooter,
  type ISidebarSection,
} from './ISidebar';

export function Sidebar({
  className,
  header,
  children,
  footer,
  overlay,
  'aria-label': ariaLabel = 'Sidebar',
}: ISidebar) {
  return (
    <>
      {overlay}
      <aside
        className={cn(
          'flex h-full flex-col border-r border-border bg-card',
          className
        )}
        aria-label={ariaLabel}
      >
        {header ? (
          <div className="flex-shrink-0 border-b border-border">{header}</div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
        {footer ? <div className="flex-shrink-0">{footer}</div> : null}
      </aside>
    </>
  );
}

export const sidebarClassNames = {
  container:
    'fixed left-0 top-12 z-[1200] flex h-[calc(100vh-48px)] flex-col overflow-x-hidden overflow-y-auto border-r border-border bg-card text-xs duration-300 scrollbar-hidden',
  expanded: 'w-[220px]',
  collapsed: 'w-[64px]',
  navSectionLabel:
    'px-2.5 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground',
  navList: 'space-y-0.5 px-2 pb-2 p-0',
  navItem:
    'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground',
  navItemActive: '!bg-primary/10 !text-primary',
  navItemIcon: 'h-4 w-4 flex-shrink-0',
  navItemText: 'flex-1 truncate',
  collapsedTooltip:
    'absolute left-full z-50 ml-2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-md transition-all duration-200 pointer-events-none invisible group-hover:visible group-hover:opacity-100',
  footer: 'mt-auto flex-shrink-0 border-t border-border',
  footerExpanded: 'flex items-center gap-2.5 px-3 py-3',
  footerCollapsed: 'flex flex-col items-center gap-1.5 py-2',
  avatar:
    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/15 text-xs font-semibold text-primary',
  profileInfo: 'min-w-0 flex-1',
  profilePrimary: 'block truncate text-xs font-medium text-foreground',
  profileSecondary: 'block text-[11px] text-muted-foreground',
  footerAction:
    'rounded-md border-none bg-transparent px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground',
} as const;

export function SidebarSection({
  className,
  label,
  children,
  isOpen = true,
}: ISidebarSection) {
  return (
    <section className={className}>
      {isOpen && label ? (
        <div className={sidebarClassNames.navSectionLabel}>{label}</div>
      ) : null}
      {children}
    </section>
  );
}

export function SidebarNav({
  className,
  children,
  'aria-label': ariaLabel = 'Sidebar navigation',
}: ISidebarNav) {
  return (
    <nav
      className={cn('flex flex-1 flex-col gap-1 overflow-y-auto p-4', className)}
      aria-label={ariaLabel}
    >
      {children}
    </nav>
  );
}

export function SidebarNavItem({
  className,
  isActive = false,
  icon,
  label,
  onClick,
  onKeyDown,
  asChild = false,
  children,
}: ISidebarNavItem) {
  const itemClassName = cn(
    sidebarClassNames.navItem,
    isActive && sidebarClassNames.navItemActive,
    className
  );

  if (asChild && children) {
    return <Slot className={itemClassName}>{children}</Slot>;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={itemClassName}
      onClick={onClick}
      onKeyDown={onKeyDown}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon ? (
        <span
          className="flex h-4 w-4 flex-shrink-0 items-center justify-center"
          aria-hidden
        >
          {icon}
        </span>
      ) : null}
      {label ?? children}
    </div>
  );
}

export function SidebarProfileFooter({
  className,
  avatarLabel,
  primaryText,
  secondaryText,
  action,
  isOpen = true,
}: ISidebarProfileFooter) {
  return (
    <div
      className={cn(
        sidebarClassNames.footer,
        isOpen
          ? sidebarClassNames.footerExpanded
          : sidebarClassNames.footerCollapsed,
        className
      )}
    >
      <div className={sidebarClassNames.avatar}>{avatarLabel}</div>
      {isOpen ? (
        <>
          <div className={sidebarClassNames.profileInfo}>
            {primaryText ? (
              <span className={sidebarClassNames.profilePrimary}>
                {primaryText}
              </span>
            ) : null}
            {secondaryText ? (
              <span className={sidebarClassNames.profileSecondary}>
                {secondaryText}
              </span>
            ) : null}
          </div>
          {action}
        </>
      ) : (
        action
      )}
    </div>
  );
}

export function SidebarBrand({
  className,
  icon,
  title,
}: {
  className?: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-6 py-5',
        className
      )}
    >
      {icon}
      <span className="font-heading text-lg font-semibold">{title}</span>
    </div>
  );
}
