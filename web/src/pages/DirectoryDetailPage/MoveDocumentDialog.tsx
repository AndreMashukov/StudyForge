import { useState } from 'react';
import { DocumentEnhanced, DirectoryTreeNode } from '@shared-types';
import { useGetDirectoryTreeQuery, useMoveDocumentMutation } from '../../store/api/Directory/DirectoryApi';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { FolderInput, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { ICON_MAP } from '../DocumentsPage/DocumentsPageContainer/folderConstants';
import { cn } from '../../lib/utils';

interface IMoveDocumentDialog {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentEnhanced | null;
  currentDirectoryId: string;
  onSuccess: () => void;
}

const DirectoryTreeItem = ({
  node,
  currentDirectoryId,
  selectedId,
  onSelect,
  depth = 0,
}: {
  node: DirectoryTreeNode;
  currentDirectoryId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}) => {
  const [expanded, setExpanded] = useState(true);
  const isCurrent = node.directory.id === currentDirectoryId;
  const isSelected = node.directory.id === selectedId;
  const hasChildren = node.children.length > 0;
  const IconComponent = ICON_MAP[node.directory.icon || 'Folder'] || Folder;

  return (
    <div>
      <button
        type="button"
        disabled={isCurrent}
        onClick={() => onSelect(node.directory.id)}
        className={cn(
          'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors text-left',
          isSelected
            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
            : 'hover:bg-muted/50 border border-transparent',
          isCurrent && 'opacity-40 cursor-not-allowed',
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
        {isCurrent && (
          <span className="text-[10px] text-muted-foreground ml-auto shrink-0">(current)</span>
        )}
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <DirectoryTreeItem
              key={child.directory.id}
              node={child}
              currentDirectoryId={currentDirectoryId}
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

export const MoveDocumentDialog = ({
  isOpen,
  onClose,
  document,
  currentDirectoryId,
  onSuccess,
}: IMoveDocumentDialog) => {
  const [selectedDirectoryId, setSelectedDirectoryId] = useState<string | null>(null);
  const { data: treeData, isLoading: isLoadingTree } = useGetDirectoryTreeQuery(undefined, {
    skip: !isOpen,
  });
  const [moveDocument, { isLoading: isMoving }] = useMoveDocumentMutation();

  const handleMove = async () => {
    if (!document || !selectedDirectoryId) return;

    try {
      await moveDocument({
        documentId: document.id,
        targetDirectoryId: selectedDirectoryId,
      }).unwrap();
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Failed to move document:', error);
    }
  };

  const handleClose = () => {
    setSelectedDirectoryId(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden">
        {/* Gradient header — matches Create Directory modal */}
        <div className="px-7 pt-7 pb-5 flex items-center gap-3.5 bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent border-b border-border">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-[0_4px_12px_rgba(139,92,246,0.3)] shrink-0">
            <FolderInput className="text-white" size={22} />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold leading-tight">Move Document</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose a destination folder for &ldquo;{document?.title}&rdquo;
            </p>
          </div>
        </div>

        <div className="px-7 py-6">
          {isLoadingTree ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : !treeData?.tree?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No directories found. Create a folder first.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-0.5 -mx-2 px-2">
              {treeData.tree.map((node) => (
                <DirectoryTreeItem
                  key={node.directory.id}
                  node={node}
                  currentDirectoryId={currentDirectoryId}
                  selectedId={selectedDirectoryId}
                  onSelect={setSelectedDirectoryId}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="px-7 pb-6">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={!selectedDirectoryId || isMoving}
            className="bg-gradient-to-r from-purple-500 to-indigo-500 border-transparent shadow-[0_2px_8px_rgba(139,92,246,0.3)] hover:shadow-[0_4px_16px_rgba(139,92,246,0.4)]"
          >
            {isMoving ? 'Moving…' : 'Move Here'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
