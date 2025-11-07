import { DirectoryTreeNode } from '@shared-types';

export interface IDirectoryTree {
  className?: string;
  onSelectDirectory?: (directoryId: string | null) => void;
  onCreateDirectory?: (parentId: string | null) => void;
  onEditDirectory?: (directoryId: string) => void;
  onDeleteDirectory?: (directoryId: string) => void;
  onMoveDirectory?: (directoryId: string, targetParentId: string | null) => void;
}

export interface IDirectoryTreeNodeProps {
  node: DirectoryTreeNode;
  level: number;
  onSelect: (directoryId: string) => void;
  onToggleExpand: (directoryId: string) => void;
  onContextMenu: (e: React.MouseEvent, directoryId: string) => void;
  isExpanded: boolean;
  isSelected: boolean;
}
