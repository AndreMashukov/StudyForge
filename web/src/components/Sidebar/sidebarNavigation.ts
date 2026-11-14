import {
  BarChart3,
  Gauge,
  Home,
  Library,
  Settings,
  Sparkles,
  User,
} from 'lucide-react';
import type { ISidebarNavigationItem } from './ISidebar';

export const studyNavigationItems: ISidebarNavigationItem[] = [
  { id: 'home', title: 'Dashboard', path: '/', icon: Home },
  {
    id: 'library',
    title: 'Library',
    path: '/documents',
    icon: Library,
    activePaths: [
      '/documents',
      '/directory',
      '/directories',
      '/document',
      '/quiz',
      '/quizzes',
      '/flashcards',
      '/slides',
      '/diagram-quiz',
      '/sequence-quiz',
      '/match-quiz',
    ],
  },
  {
    id: 'progress',
    title: 'Progress',
    path: '/statistics',
    icon: BarChart3,
    activePaths: ['/statistics', '/stats'],
  },
];

export const toolNavigationItems: ISidebarNavigationItem[] = [
  { id: 'rules', title: 'Rules', path: '/rules', icon: Sparkles },
];

export const usageNavigationItem: ISidebarNavigationItem = {
  id: 'usage',
  title: 'Usage & plan',
  path: '/usage',
  icon: Gauge,
};

export const settingsNavigationItem: ISidebarNavigationItem = {
  id: 'settings',
  title: 'Settings',
  path: '/settings',
  icon: Settings,
};

export const accountNavigationItems: ISidebarNavigationItem[] = [
  { id: 'profile', title: 'Profile', path: '/profile', icon: User },
  usageNavigationItem,
];

export function isSidebarItemActive(
  item: ISidebarNavigationItem,
  pathname: string,
): boolean {
  return (item.activePaths ?? [item.path]).some(
    (path) =>
      pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)),
  );
}
