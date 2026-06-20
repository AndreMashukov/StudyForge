import { IFolderCard } from "./IFolderCard";
import { folderCardStyles } from "./FolderCard.styles";
import { Folder, FileText, FolderTree, Edit, Trash2, Move, FileCode, MoreVertical } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../../components/ui/DropdownMenu";
import { ICON_MAP } from "../folderConstants";

export const FolderCard = ({
  directory,
  onClick,
  onEdit,
  onDelete,
  onMove,
  onManageRules,
}: IFolderCard) => {
  const IconComponent = ICON_MAP[directory.icon || "Folder"] || Folder;

  return (
    <div
      className={folderCardStyles.card}
      onClick={onClick}
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
      <div className={folderCardStyles.iconContainer}>
        <IconComponent
          size={48}
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

      {/* Actions Dropdown (on hover) */}
      <div
        className={folderCardStyles.actions}
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              title="Folder actions"
              aria-label={`Actions for ${directory.name}`}
            >
              <MoreVertical size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => onEdit?.()}
              disabled={!onEdit}
            >
              <Edit size={14} className="mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onManageRules?.()}
              disabled={!onManageRules}
            >
              <FileCode size={14} className="mr-2" />
              Manage Rules
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onMove?.()}
              disabled={!onMove}
            >
              <Move size={14} className="mr-2" />
              Move to...
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete?.()}
              disabled={!onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 size={14} className="mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
