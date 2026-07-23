import React, { useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  MoreVertical,
  Loader2,
} from 'lucide-react';
import { IDirectoryTree, IDirectoryTreeNodeProps } from './IDirectoryTree';
import { useGetDirectoryTreeQuery } from '../../store/api/Directory/DirectoryApi';
import { Spinner } from '../ui/Spinner';
import {
  selectSelectedDirectoryId,
  selectExpandedDirectoryIds,
  setSelectedDirectory,
  toggleExpandDirectory,
} from '../../store/slices/directorySlice';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { useAppDispatch } from '../../hooks/redux';
import { prefetchDirectoryContents } from '../../pages/DocumentsPage/utils/prefetchDirectoryContents';

const PREFETCH_DEBOUNCE_MS = 150;

const DirectoryTreeNode: React.FC<IDirectoryTreeNodeProps> = ({
  node,
  level,
  onSelect,
  onToggleExpand,
  onContextMenu,
  onPrefetchDirectory,
  isExpanded,
  isSelected,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const FolderIcon = isExpanded ? FolderOpen : Folder;
  const childDirectoryIds = node.children.map((child) => child.directory.id);

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-muted/50 transition-colors',
          isSelected && 'bg-primary/10 hover:bg-primary/15',
          level > 0 && 'ml-4'
        )}
        onClick={() => onSelect(node.directory.id, node.directory.name)}
        onContextMenu={(e) => onContextMenu(e, node.directory.id, node.directory.name)}
      >
        {/* Expand/Collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) {
              onToggleExpand(node.directory.id, childDirectoryIds);
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
            onContextMenu(e, node.directory.id, node.directory.name);
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
              onPrefetchDirectory={onPrefetchDirectory}
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
  onPrefetchDirectory: IDirectoryTreeNodeProps['onPrefetchDirectory'];
}> = ({ node, level, onSelect, onToggleExpand, onContextMenu, onPrefetchDirectory }) => {
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
      onPrefetchDirectory={onPrefetchDirectory}
      isExpanded={isExpanded}
      isSelected={isSelected}
    />
  );
};

export const DirectoryTree: React.FC<IDirectoryTree> = ({
  className,
  onSelectDirectory,
  onCreateDirectory,
}) => {
  const dispatch = useDispatch();
  const appDispatch = useAppDispatch();
  const selectedDirectoryId = useSelector(selectSelectedDirectoryId);
  const expandedDirectoryIds = useSelector(selectExpandedDirectoryIds);
  const { data, isLoading, isFetching, error } = useGetDirectoryTreeQuery();

  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const schedulePrefetch = useCallback(
    (directoryId: string | null) => {
      const key = directoryId ?? '__root__';
      const existing = debounceTimersRef.current.get(key);
      if (existing) {
        clearTimeout(existing);
      }

      debounceTimersRef.current.set(
        key,
        setTimeout(() => {
          prefetchDirectoryContents(appDispatch, directoryId);
          debounceTimersRef.current.delete(key);
        }, PREFETCH_DEBOUNCE_MS),
      );
    },
    [appDispatch],
  );

  const handlePrefetchDirectory = useCallback(
    (directoryId: string) => {
      schedulePrefetch(directoryId);
    },
    [schedulePrefetch],
  );

  const handleSelect = (directoryId: string, directoryName: string) => {
    if (onSelectDirectory) {
      onSelectDirectory(directoryId, directoryName);
    } else {
      dispatch(setSelectedDirectory(directoryId));
    }
  };

  const handleToggleExpand = (directoryId: string, childDirectoryIds: string[]) => {
    dispatch(toggleExpandDirectory(directoryId));
  };

  const handleContextMenu = (e: React.MouseEvent, directoryId: string, directoryName: string) => {
    e.preventDefault();
    handleSelect(directoryId, directoryName);
  };

  if (isLoading && !data) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <Spinner size="md" />
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
          onClick={() => onCreateDirectory?.(selectedDirectoryId)}
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
    <div className={cn('py-2 relative', className)}>
      {isFetching && data && (
        <Loader2
          className="absolute top-2 right-2 h-3.5 w-3.5 animate-spin text-muted-foreground"
          aria-label="Refreshing"
        />
      )}

      {/* Root directory option */}
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-muted/50 transition-colors mb-2',
          !selectedDirectoryId && 'bg-primary/10 hover:bg-primary/15'
        )}
        onClick={() => {
          if (onSelectDirectory) {
            onSelectDirectory(null);
          } else {
            dispatch(setSelectedDirectory(null));
          }
        }}
      >
        <Folder className="w-4 h-4 text-muted-foreground ml-4" />
        <span className="flex-1 text-sm">Root</span>
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
          onPrefetchDirectory={handlePrefetchDirectory}
        />
      ))}

      {/* Create new folder button - creates subfolder if a directory is selected */}
      <div className="mt-4 px-2">
        <Button
          onClick={() => onCreateDirectory?.(selectedDirectoryId)}
          variant="ghost"
          size="sm"
          className="w-full justify-start"
        >
          <Plus className="w-4 h-4 mr-2" />
          {selectedDirectoryId ? 'New Subfolder' : 'New Folder'}
        </Button>
      </div>
    </div>
  );
};
