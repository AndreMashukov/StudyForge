import { DirectoryTreeNode } from '@shared-types';

export interface IDirectoryTree {
  className?: string;
  onSelectDirectory?: (directoryId: string | null, directoryName?: string) => void;
  onCreateDirectory?: (parentId: string | null) => void;
  onEditDirectory?: (directoryId: string) => void;
  onDeleteDirectory?: (directoryId: string) => void;
  onMoveDirectory?: (directoryId: string, targetParentId: string | null) => void;
}

export interface IDirectoryTreeNodeProps {
  node: DirectoryTreeNode;
  level: number;
  onSelect: (directoryId: string, directoryName: string) => void;
  onToggleExpand: (directoryId: string, childDirectoryIds: string[]) => void;
  onContextMenu: (e: React.MouseEvent, directoryId: string, directoryName: string) => void;
  onPrefetchDirectory: (directoryId: string) => void;
  isExpanded: boolean;
  isSelected: boolean;
}
