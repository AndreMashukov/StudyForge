'use client';

import Link from 'next/link';
import { Menu, ShieldCheck } from 'lucide-react';
import {
  ThemeToggle,
  TopAppBar,
  TopAppBarBrand,
  TopAppBarMenuButton,
} from '@study-forge/ui';

export interface IAdminHeaderProps {
  onToggleSidebar: () => void;
}

export function AdminHeader({ onToggleSidebar }: IAdminHeaderProps) {
  return (
    <TopAppBar
      start={
        <TopAppBarMenuButton
          onClick={onToggleSidebar}
          icon={<Menu size={18} />}
          aria-label="Toggle sidebar"
        />
      }
      brand={
        <TopAppBarBrand asChild>
          <Link href="/" aria-label="StudyForge Admin">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <ShieldCheck size={16} aria-hidden />
            </span>
            <span className="app-title-responsive text-sm font-semibold tracking-tight text-foreground">
              StudyForge Admin
            </span>
          </Link>
        </TopAppBarBrand>
      }
      end={<ThemeToggle />}
    />
  );
}
