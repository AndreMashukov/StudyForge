import React from 'react';
import * as Popover from '@radix-ui/react-popover';
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
  const handleItemClick = (item: IActionsDropdownItem) => {
    if (!item.disabled) {
      item.onClick();
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
    <Popover.Root>
      <Popover.Trigger asChild disabled={disabled}>
        {trigger || defaultTrigger}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className={cn(actionsDropdownStyles.content)}
          align={align}
          sideOffset={4}
          collisionPadding={10}
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
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};