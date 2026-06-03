'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import {
  ThemeToggle,
  TopAppBar,
  TopAppBarBrand,
  TopAppBarBrandContent,
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
          <Link href="/" aria-label="StudyForge">
            <TopAppBarBrandContent />
          </Link>
        </TopAppBarBrand>
      }
      end={<ThemeToggle />}
    />
  );
}
