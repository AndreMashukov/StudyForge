'use client';

import { useLinkStatus } from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn, sidebarClassNames } from '@study-forge/ui';

export interface IAdminNavLinkContentProps {
  label: string;
  icon: LucideIcon;
  isOpen: boolean;
}

export function AdminNavLinkContent({
  label,
  icon: Icon,
  isOpen,
}: IAdminNavLinkContentProps) {
  const { pending } = useLinkStatus();

  return (
    <>
      <Icon
        className={cn(
          sidebarClassNames.navItemIcon,
          pending && 'animate-pulse opacity-60'
        )}
        size={16}
        aria-hidden
      />
      {isOpen ? (
        <span
          className={cn(
            sidebarClassNames.navItemText,
            pending && 'text-muted-foreground'
          )}
        >
          {label}
          {pending ? (
            <span className="sr-only"> (loading)</span>
          ) : null}
        </span>
      ) : (
        <div className={sidebarClassNames.collapsedTooltip}>{label}</div>
      )}
    </>
  );
}
