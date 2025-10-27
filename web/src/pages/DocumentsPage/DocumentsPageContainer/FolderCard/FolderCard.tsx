import { useState } from "react";
import { IFolderCard } from "./IFolderCard";
import { getFolderCardClassName, getIconClassName, folderCardStyles } from "./FolderCard.styles";
import { Folder, FolderOpen, Briefcase, Target, Zap, Rocket, FileText, FolderTree, Edit, Trash2, Move } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { ContextMenu, ContextMenuItem } from "../../../../components/ui/ContextMenu";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  Folder,
  "Folder Open": FolderOpen,
  Briefcase,
  Target,
  Zap,
  Rocket,
};

export const FolderCard = ({
  directory,
  onClick,
  onEdit,
  onDelete,
  onMove,
  viewMode,
}: IFolderCard) => {
  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; x: number; y: number }>({
    isOpen: false,
    x: 0,
    y: 0,
  });

  const IconComponent = ICON_MAP[directory.icon || "Folder"] || Folder;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const contextMenuItems: ContextMenuItem[] = [
    {
      id: "edit",
      label: "Edit",
      icon: Edit,
      onClick: () => onEdit?.(),
      disabled: !onEdit,
    },
    {
      id: "move",
      label: "Move to...",
      icon: Move,
      onClick: () => onMove?.(),
      disabled: !onMove,
    },
    {
      id: "delete",
      label: "Delete",
      icon: Trash2,
      onClick: () => onDelete?.(),
      disabled: !onDelete,
      destructive: true,
    },
  ];

  return (
    <>
      <div
        className={getFolderCardClassName(viewMode)}
        onClick={onClick}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {/* Icon */}
        <div className={getIconClassName(viewMode)}>
          <IconComponent
            size={viewMode === "grid" ? 48 : 32}
            color={directory.color || "#6b7280"}
          />
        </div>

        {/* Content */}
        <div className={folderCardStyles.content}>
          <h3 className={folderCardStyles.title}>{directory.name}</h3>
          <div className={folderCardStyles.metadata}>
            <span className={folderCardStyles.count}>
              <FileText size={14} />
              {directory.documentCount}
            </span>
            <span className={folderCardStyles.count}>
              <FolderTree size={14} />
              {directory.childCount}
            </span>
          </div>
        </div>

        {/* Action Buttons (on hover) */}
        <div className={folderCardStyles.actions}>
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title="Edit folder"
            >
              <Edit size={16} />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete folder"
            >
              <Trash2 size={16} />
            </Button>
          )}
        </div>
      </div>

      {/* Context Menu */}
      <ContextMenu
        items={contextMenuItems}
        isOpen={contextMenu.isOpen}
        position={{ x: contextMenu.x, y: contextMenu.y }}
        onClose={() => setContextMenu({ ...contextMenu, isOpen: false })}
      />
    </>
  );
};
