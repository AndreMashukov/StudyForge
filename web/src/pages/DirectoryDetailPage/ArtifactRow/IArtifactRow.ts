import type { LucideIcon } from 'lucide-react';
import type { GenerationStatus } from '../../../types/generationStatus';

export interface IArtifactRow {
  icon: LucideIcon;
  title: string;
  createdAt: Date | { toDate(): Date } | { _seconds: number; _nanoseconds: number } | string | number | null | undefined;
  linkTo: string;
  onDelete: () => void;
  deleteAriaLabel: string;
  appliedRuleNames?: string[];
  completedAt?: Date | { toDate(): Date } | { _seconds: number; _nanoseconds: number } | string | number | null | undefined;
  generationModel?: string;
  generationStatus?: GenerationStatus;
  generationError?: string;
  /** Primary source document color for left-rail accent. */
  documentColor?: string;
  /** Source document colors for multi-doc segmented rail. */
  documentColors?: string[];
  onLinkHover?: () => void;
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
}
