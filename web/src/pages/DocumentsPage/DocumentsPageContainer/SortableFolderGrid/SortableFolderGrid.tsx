import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../../../lib/utils';
import type { ISortableFolderGrid } from './ISortableFolderGrid';

interface ISortableFolderTile {
  id: string;
  name: string;
  children: React.ReactNode;
  suppressClickRef: React.MutableRefObject<boolean>;
  className: string;
}

const SortableFolderTile: React.FC<ISortableFolderTile> = ({
  id,
  name,
  children,
  suppressClickRef,
  className,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  // The card inside opens the folder on Enter or Space, so keyboard dragging
  // starts only when the tile itself (not the card) has focus.
  const tileListeners = useMemo(() => {
    if (!listeners) {
      return listeners;
    }
    return {
      ...listeners,
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        listeners.onKeyDown?.(event);
      },
    };
  }, [listeners]);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...tileListeners}
      aria-roledescription="sortable folder"
      aria-label={`Reorder folder ${name}`}
      className={cn(
        className,
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
      onClickCapture={(event) => {
        if (suppressClickRef.current) {
          event.preventDefault();
          event.stopPropagation();
          suppressClickRef.current = false;
        }
      }}
    >
      {children}
    </div>
  );
};

/**
 * Folder cards that can be dragged to change their order among siblings.
 * The order is saved by the caller; the list re-renders from the folder data.
 */
export const SortableFolderGrid: React.FC<ISortableFolderGrid> = ({
  folders,
  renderFolder,
  onReorder,
  disabled = false,
  className,
  tileClassName = 'rounded-lg',
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const suppressClickRef = useRef(false);
  const folderIds = useMemo(
    () => folders.map((folder) => folder.id),
    [folders],
  );
  const activeFolder = useMemo(
    () => folders.find((folder) => folder.id === activeId) ?? null,
    [activeId, folders],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      // A pointer drag can end with a click on the card; do not open the
      // folder. The flag clears on that click, or shortly after if none comes.
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 250);
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }
      const oldIndex = folderIds.indexOf(String(active.id));
      const newIndex = folderIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) {
        return;
      }
      onReorder(arrayMove(folderIds, oldIndex, newIndex));
    },
    [folderIds, onReorder],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  if (disabled) {
    return (
      <div className={className}>
        {folders.map((folder) => (
          <React.Fragment key={folder.id}>
            {renderFolder(folder)}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={folderIds} strategy={rectSortingStrategy}>
        <div className={className}>
          {folders.map((folder) => (
            <SortableFolderTile
              key={folder.id}
              id={folder.id}
              name={folder.name}
              suppressClickRef={suppressClickRef}
              className={tileClassName}
            >
              {renderFolder(folder)}
            </SortableFolderTile>
          ))}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeFolder ? (
          <div
            className={cn(
              tileClassName,
              'cursor-grabbing bg-background opacity-95 shadow-lg',
            )}
          >
            {renderFolder(activeFolder)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
