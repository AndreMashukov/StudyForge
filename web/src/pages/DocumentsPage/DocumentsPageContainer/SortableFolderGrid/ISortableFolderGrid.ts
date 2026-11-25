import type React from 'react';
import type { Directory } from '@shared-types';

export interface ISortableFolderGrid {
  folders: Directory[];
  renderFolder: (folder: Directory) => React.ReactNode;
  /** Called with every folder id in the new order after a drop. */
  onReorder: (orderedDirectoryIds: string[]) => void;
  /** Plain grid without drag and drop (phone-width screens). */
  disabled?: boolean;
  className?: string;
}
