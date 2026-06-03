'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, FileText, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/documents', label: 'Documents', icon: FileText },
];

export function AdminSidebar() {
  const currentPath = usePathname();
  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-6 py-5">
        <Shield className="h-5 w-5 text-primary" aria-hidden />
        <span className="font-heading text-lg font-semibold">Study Forge Admin</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-4" aria-label="Admin navigation">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/'
              ? currentPath === '/'
              : currentPath === href || currentPath.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
