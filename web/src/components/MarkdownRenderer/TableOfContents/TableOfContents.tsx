import React from 'react';
import { ITableOfContents } from './ITableOfContents';
import { TocItem } from '../IMarkdownRenderer';
import { cn } from '../../../lib/utils';

const TocItemComponent = ({ 
  item, 
  activeId, 
  onItemClick 
}: { 
  item: TocItem; 
  activeId?: string; 
  onItemClick?: (id: string) => void;
}) => {
  const isActive = activeId === item.id;
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onItemClick) {
      onItemClick(item.id);
    } else {
      // Default scroll behavior
      const element = document.getElementById(item.id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <li className="mb-1">
      <a
        href={`#${item.id}`}
        onClick={handleClick}
        className={cn(
          "block py-1 px-2 text-sm rounded-md transition-colors hover:bg-muted/50",
          "border-l-2 border-transparent hover:border-primary/30",
          `ml-${Math.max(0, (item.level - 1) * 2)}`,
          isActive && "bg-muted border-primary text-primary font-medium",
          !isActive && "text-muted-foreground hover:text-foreground"
        )}
      >
        {item.title}
      </a>
      {item.children && item.children.length > 0 && (
        <ul className="mt-1">
          {item.children.map((child) => (
            <TocItemComponent
              key={child.id}
              item={child}
              activeId={activeId}
              onItemClick={onItemClick}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export const TableOfContents = ({ 
  items, 
  className, 
  activeId,
  onItemClick 
}: ITableOfContents) => {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <nav className={cn("space-y-2", className)}>
      <h3 className="text-sm font-semibold text-foreground mb-3 px-2">
        Table of Contents
      </h3>
      <ul className="space-y-0">
        {items.map((item) => (
          <TocItemComponent
            key={item.id}
            item={item}
            activeId={activeId}
            onItemClick={onItemClick}
          />
        ))}
      </ul>
    </nav>
  );
};