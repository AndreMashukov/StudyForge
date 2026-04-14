import { useState } from 'react';
import { DirectoryTreeNode } from '@shared-types';
import { useGetDirectoryTreeQuery, useMoveDirectoryMutation } from '../../../../store/api/Directory/DirectoryApi';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '../../../../components/ui/Dialog';
import { Button } from '../../../../components/ui/Button';
import { FolderInput, Folder, ChevronRight, ChevronDown, Home } from 'lucide-react';
import { ICON_MAP } from '../folderConstants';
import { cn } from '../../../../lib/utils';
import { Spinner } from '../../../../components/ui/Spinner';
import { IMoveDirectoryDialog } from './IMoveDirectoryDialog';

// Sentinel value meaning "move to root (no parent)"
const ROOT_ID = '__root__';

function isDescendantOrSelf(node: DirectoryTreeNode, sourcePath: string): boolean {
  const nodePath = node.directory.path;
  return nodePath === sourcePath || nodePath.startsWith(sourcePath + '/');
}

const DirectoryTreeItem = ({
  node,
  sourcePath,
  selectedId,
  onSelect,
  depth = 0,
}: {
  node: DirectoryTreeNode;
  sourcePath: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}) => {
  const [expanded, setExpanded] = useState(true);
  const isDisabled = isDescendantOrSelf(node, sourcePath);
  const isSelected = node.directory.id === selectedId;
  const hasChildren = node.children.length > 0;
  const IconComponent = ICON_MAP[node.directory.icon || 'Folder'] || Folder;

  return (
    <div>
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => onSelect(node.directory.id)}
        className={cn(
          'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors text-left',
          isSelected
            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
            : 'hover:bg-muted/50 border border-transparent',
          isDisabled && 'opacity-40 cursor-not-allowed',
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="shrink-0 p-0.5 rounded hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <IconComponent
          size={16}
          color={node.directory.color || undefined}
          className={cn('shrink-0', !node.directory.color && 'text-primary')}
        />
        <span className="truncate">{node.directory.name}</span>
        {isDescendantOrSelf(node, sourcePath) && node.directory.path === sourcePath && (
          <span className="text-[10px] text-muted-foreground ml-auto shrink-0">(current)</span>
        )}
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <DirectoryTreeItem
              key={child.directory.id}
              node={child}
              sourcePath={sourcePath}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const MoveDirectoryDialog = ({
  isOpen,
  onClose,
  directory,
  onSuccess,
}: IMoveDirectoryDialog) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: treeData, isLoading: isLoadingTree } = useGetDirectoryTreeQuery(undefined, {
    skip: !isOpen,
  });
  const [moveDirectory, { isLoading: isMoving }] = useMoveDirectoryMutation();

  const handleMove = async () => {
    if (!directory || selectedId === null) return;

    const targetParentId = selectedId === ROOT_ID ? null : selectedId;

    try {
      await moveDirectory({
        id: directory.id,
        data: { targetParentId },
      }).unwrap();
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Failed to move directory:', error);
    }
  };

  const handleClose = () => {
    setSelectedId(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden">
        <div className="px-7 pt-7 pb-5 flex items-center gap-3.5 bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent border-b border-border">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-[0_4px_12px_rgba(139,92,246,0.3)] shrink-0">
            <FolderInput className="text-white" size={22} />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold leading-tight">Move Folder</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose a destination for &ldquo;{directory?.name}&rdquo;
            </p>
          </div>
        </div>

        <div className="px-7 py-6">
          {isLoadingTree ? (
            <div className="flex justify-center py-8">
              <Spinner size="sm" />
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-0.5 -mx-2 px-2">
              <button
                type="button"
                onClick={() => setSelectedId(ROOT_ID)}
                disabled={directory?.parentId === null}
                className={cn(
                  'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors text-left',
                  selectedId === ROOT_ID
                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                    : 'hover:bg-muted/50 border border-transparent',
                  directory?.parentId === null && 'opacity-40 cursor-not-allowed',
                )}
              >
                <span className="w-4" />
                <Home size={16} className="shrink-0 text-muted-foreground" />
                <span>Root</span>
                {directory?.parentId === null && (
                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">(current)</span>
                )}
              </button>

              {!treeData?.tree?.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No other folders found.
                </p>
              ) : (
                directory && treeData.tree.map((node) => (
                  <DirectoryTreeItem
                    key={node.directory.id}
                    node={node}
                    sourcePath={directory.path}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                ))
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-7 pb-6">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={selectedId === null || isMoving}
          >
            {isMoving ? 'Moving…' : 'Move Here'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
