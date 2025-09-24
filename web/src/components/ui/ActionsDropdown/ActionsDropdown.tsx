import React, { useState, useRef, useEffect } from 'react';
import { cn } from "../../../lib/utils";
import { IActionsDropdown, IActionsDropdownItem } from './IActionsDropdown';
import { actionsDropdownStyles } from './ActionsDropdown.styles';
import { ChevronDown } from 'lucide-react';

export const ActionsDropdown = ({ 
  items, 
  trigger, 
  align = 'end', 
  disabled = false,
  className 
}: IActionsDropdown) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleItemClick = (item: IActionsDropdownItem) => {
    if (!item.disabled) {
      item.onClick();
      setIsOpen(false);
    }
  };

  const defaultTrigger = (
    <button
      className={cn(actionsDropdownStyles.trigger, className)}
      disabled={disabled}
    >
      Actions
      <ChevronDown className="ml-2 h-4 w-4" />
    </button>
  );

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="cursor-pointer"
      >
        {trigger || defaultTrigger}
      </div>

      {isOpen && (
        <div 
          className={cn(
            actionsDropdownStyles.content,
            align === 'end' ? 'right-0' : 'left-0',
            'absolute top-full mt-1'
          )}
          role="menu"
          aria-orientation="vertical"
        >
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                actionsDropdownStyles.item,
                item.destructive && actionsDropdownStyles.itemDestructive,
                item.disabled && 'opacity-50 cursor-not-allowed',
                !item.disabled && 'hover:bg-accent hover:text-accent-foreground cursor-pointer'
              )}
              onClick={() => handleItemClick(item)}
              role="menuitem"
              aria-disabled={item.disabled}
            >
              {item.icon && (
                <span className={actionsDropdownStyles.itemIcon}>
                  {item.icon}
                </span>
              )}
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};