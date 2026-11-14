import type { LucideIcon } from 'lucide-react';

export interface ISidebar {
  className?: string;
}

export interface ISidebarNavigationItem {
  id: string;
  title: string;
  path: string;
  icon: LucideIcon;
  activePaths?: string[];
}

export interface SidebarSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  items: SidebarItem[];
}

export interface SidebarItem {
  id: string;
  title: string;
  path: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  isActive?: boolean;
}
