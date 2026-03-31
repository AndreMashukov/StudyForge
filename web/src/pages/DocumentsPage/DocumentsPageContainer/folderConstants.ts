import React from 'react';
import {
  Folder,
  FolderOpen,
  Briefcase,
  Target,
  Zap,
  Rocket,
  BookOpen,
  GraduationCap,
  FileText,
  Layers,
  Sun,
  Flame,
  Heart,
  BadgeCheck,
  CircleCheck,
  LayoutGrid,
} from 'lucide-react';

export const FOLDER_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#2563eb' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Violet', value: '#a855f7' },
  { name: 'Fuchsia', value: '#d946ef' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Slate', value: '#64748b' },
  { name: 'Gray', value: '#6b7280' },
  { name: 'Stone', value: '#78716c' },
  { name: 'Warm Gray', value: '#a8a29e' },
];

export const FOLDER_ICONS = [
  { name: 'Folder', component: Folder, label: 'Folder' },
  { name: 'Folder Open', component: FolderOpen, label: 'Open' },
  { name: 'Briefcase', component: Briefcase, label: 'Briefcase' },
  { name: 'Target', component: Target, label: 'Target' },
  { name: 'Zap', component: Zap, label: 'Zap' },
  { name: 'Rocket', component: Rocket, label: 'Rocket' },
  { name: 'BookOpen', component: BookOpen, label: 'Book' },
  { name: 'GraduationCap', component: GraduationCap, label: 'Grad Cap' },
  { name: 'FileText', component: FileText, label: 'File' },
  { name: 'Layers', component: Layers, label: 'Layers' },
  { name: 'Flame', component: Flame, label: 'Flame' },
  { name: 'Heart', component: Heart, label: 'Heart' },
  { name: 'BadgeCheck', component: BadgeCheck, label: 'Badge' },
  { name: 'Sun', component: Sun, label: 'Sun' },
  { name: 'CircleCheck', component: CircleCheck, label: 'Check' },
  { name: 'LayoutGrid', component: LayoutGrid, label: 'Grid' },
];

/** Maps icon name strings to Lucide components for rendering in FolderCard, DirectoryDetailPage, etc. */
export const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string; className?: string }>> = {};
FOLDER_ICONS.forEach((icon) => {
  ICON_MAP[icon.name] = icon.component;
});
