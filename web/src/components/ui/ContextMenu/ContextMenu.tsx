import { useEffect, useRef, useState } from "react";
import { IContextMenu } from "./IContextMenu";
import { cn } from "../../../lib/utils";

export const ContextMenu = ({ items, isOpen, position, onClose }: IContextMenu) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Reset focused index when menu opens/closes
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(-1);
    }
  }, [isOpen]);

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

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setFocusedIndex(prev => {
          if (prev === -1) return items.findIndex(item => !item.disabled);
          const nextIndex = items.findIndex((item, idx) => idx > prev && !item.disabled);
          return nextIndex === -1 ? items.findIndex(item => !item.disabled) : nextIndex;
        });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setFocusedIndex(prev => {
          if (prev === -1) {
            // Find last enabled item
            for (let i = items.length - 1; i >= 0; i--) {
              if (!items[i].disabled) return i;
            }
            return -1;
          }
          // Find previous enabled item
          for (let i = prev - 1; i >= 0; i--) {
            if (!items[i].disabled) return i;
          }
          // Wrap to last enabled item
          for (let i = items.length - 1; i >= 0; i--) {
            if (!items[i].disabled) return i;
          }
          return -1;
        });
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (focusedIndex >= 0 && !items[focusedIndex].disabled) {
          items[focusedIndex].onClick();
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, items, focusedIndex]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] rounded-md border bg-popover p-1 shadow-md"
      style={{
        top: position.y,
        left: position.x,
      }}
      tabIndex={-1}
    >
      {items.map((item, index) => {
        const IconComponent = item.icon;
        const isFocused = index === focusedIndex;
        
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
            tabIndex={-1}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              "disabled:pointer-events-none disabled:opacity-50",
              item.destructive && "text-destructive hover:bg-destructive/10",
              "focus:outline-none focus:bg-transparent focus:text-inherit"
            )}
            data-focused={isFocused}
            style={isFocused ? {
              backgroundColor: 'hsl(var(--accent))',
              color: 'hsl(var(--accent-foreground))',
            } : undefined}
          >
            {IconComponent && <IconComponent size={16} />}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
