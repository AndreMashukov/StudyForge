import type { LucideIcon } from 'lucide-react';

export interface IArtifactRow {
  icon: LucideIcon;
  title: string;
  createdAt: Date | { toDate(): Date } | { _seconds: number; _nanoseconds: number } | string | number | null | undefined;
  linkTo: string;
  onDelete: () => void;
  deleteAriaLabel: string;
  appliedRuleNames?: string[];
}
