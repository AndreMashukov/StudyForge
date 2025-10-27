import { useEffect, useRef } from "react";
import { IContextMenu } from "./IContextMenu";
import { cn } from "../../../lib/utils";

export const ContextMenu = ({ items, isOpen, position, onClose }: IContextMenu) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] rounded-md border bg-popover p-1 shadow-md"
      style={{
        top: position.y,
        left: position.x,
      }}
    >
      {items.map((item, index) => {
        const IconComponent = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            disabled={item.disabled}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              "focus:bg-accent focus:text-accent-foreground",
              "disabled:pointer-events-none disabled:opacity-50",
              item.destructive && "text-destructive hover:bg-destructive/10"
            )}
            autoFocus={index === 0}
          >
            {IconComponent && <IconComponent size={16} />}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
