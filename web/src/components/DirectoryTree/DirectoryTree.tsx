import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  MoreVertical,
} from 'lucide-react';
import { IDirectoryTree, IDirectoryTreeNodeProps } from './IDirectoryTree';
import { useGetDirectoryTreeQuery } from '../../store/api/Directory/DirectoryApi';
import {
  selectSelectedDirectoryId,
  selectExpandedDirectoryIds,
  setSelectedDirectory,
  toggleExpandDirectory,
} from '../../store/slices/directorySlice';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

const DirectoryTreeNode: React.FC<IDirectoryTreeNodeProps> = ({
  node,
  level,
  onSelect,
  onToggleExpand,
  onContextMenu,
  isExpanded,
  isSelected,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const FolderIcon = isExpanded ? FolderOpen : Folder;

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-muted/50 transition-colors',
          isSelected && 'bg-primary/10 hover:bg-primary/15',
          level > 0 && 'ml-4'
        )}
        onClick={() => onSelect(node.directory.id)}
        onContextMenu={(e) => onContextMenu(e, node.directory.id)}
      >
        {/* Expand/Collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) {
              onToggleExpand(node.directory.id);
            }
          }}
          className={cn(
            'flex items-center justify-center w-4 h-4',
            !hasChildren && 'opacity-0'
          )}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )
          )}
        </button>

        {/* Folder icon with optional color */}
        <FolderIcon
          className={cn(
            'w-4 h-4',
            node.directory.color ? `text-${node.directory.color}-500` : 'text-muted-foreground'
          )}
        />

        {/* Directory name */}
        <span className={cn(
          'flex-1 text-sm truncate',
          isSelected && 'font-medium'
        )}>
          {node.directory.name}
        </span>

        {/* Document count badge */}
        {node.directory.documentCount > 0 && (
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {node.directory.documentCount}
          </span>
        )}

        {/* Action buttons (simplified for now - will add context menu later) */}
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onContextMenu(e, node.directory.id);
          }}
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>

      {/* Render children if expanded */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child: IDirectoryTreeNodeProps['node']) => (
            <DirectoryTreeNodeWrapper
              key={child.directory.id}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const DirectoryTreeNodeWrapper: React.FC<{
  node: IDirectoryTreeNodeProps['node'];
  level: number;
  onSelect: IDirectoryTreeNodeProps['onSelect'];
  onToggleExpand: IDirectoryTreeNodeProps['onToggleExpand'];
  onContextMenu: IDirectoryTreeNodeProps['onContextMenu'];
}> = ({ node, level, onSelect, onToggleExpand, onContextMenu }) => {
  const selectedDirectoryId = useSelector(selectSelectedDirectoryId);
  const expandedDirectoryIds = useSelector(selectExpandedDirectoryIds);

  const isExpanded = expandedDirectoryIds.includes(node.directory.id);
  const isSelected = selectedDirectoryId === node.directory.id;

  return (
    <DirectoryTreeNode
      node={node}
      level={level}
      onSelect={onSelect}
      onToggleExpand={onToggleExpand}
      onContextMenu={onContextMenu}
      isExpanded={isExpanded}
      isSelected={isSelected}
    />
  );
};

export const DirectoryTree: React.FC<IDirectoryTree> = ({
  className,
  onSelectDirectory,
  onCreateDirectory,
  onEditDirectory,
  onDeleteDirectory,
  onMoveDirectory,
}) => {
  const dispatch = useDispatch();
  const selectedDirectoryId = useSelector(selectSelectedDirectoryId);
  const { data, isLoading, error } = useGetDirectoryTreeQuery();

  const handleSelect = (directoryId: string) => {
    if (onSelectDirectory) {
      // If parent provides a handler, use that (it will handle Redux + URL)
      onSelectDirectory(directoryId);
    } else {
      // Fallback: only update Redux
      dispatch(setSelectedDirectory(directoryId));
    }
  };

  const handleToggleExpand = (directoryId: string) => {
    dispatch(toggleExpandDirectory(directoryId));
  };

  const handleContextMenu = (e: React.MouseEvent, directoryId: string) => {
    e.preventDefault();
    // Context menu handling will be implemented with the dialogs
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4 text-sm text-destructive', className)}>
        Failed to load directories
      </div>
    );
  }

  if (!data || data.tree.length === 0) {
    return (
      <div className={cn('p-4', className)}>
        <div className="text-sm text-muted-foreground text-center mb-4">
          No folders yet
        </div>
        <Button
          onClick={() => onCreateDirectory?.(null)}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create First Folder
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('py-2', className)}>
      {/* Root directory option */}
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-muted/50 transition-colors mb-2',
          !selectedDirectoryId && 'bg-primary/10 hover:bg-primary/15'
        )}
        onClick={() => {
          if (onSelectDirectory) {
            // If parent provides a handler, use that (it will handle Redux + URL)
            onSelectDirectory(null);
          } else {
            // Fallback: only update Redux
            dispatch(setSelectedDirectory(null));
          }
        }}
      >
        <Folder className="w-4 h-4 text-muted-foreground ml-4" />
        <span className="flex-1 text-sm">All Documents</span>
      </div>

      {/* Directory tree */}
      {data.tree.map((node) => (
        <DirectoryTreeNodeWrapper
          key={node.directory.id}
          node={node}
          level={0}
          onSelect={handleSelect}
          onToggleExpand={handleToggleExpand}
          onContextMenu={handleContextMenu}
        />
      ))}

      {/* Create new folder button */}
      <div className="mt-4 px-2">
        <Button
          onClick={() => onCreateDirectory?.(null)}
          variant="ghost"
          size="sm"
          className="w-full justify-start"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Folder
        </Button>
      </div>
    </div>
  );
};
