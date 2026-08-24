import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type {
  GenerationStatus,
  ReorderableDirectoryItemType,
} from '@shared-types';
import { cn } from '../../../lib/utils';
import { useReorderDirectoryItemsMutation } from '../../../store/api/Directory/DirectoryApi';

interface IReorderableItem {
  id: string;
  generationStatus?: GenerationStatus;
}

interface ISortableDirectoryListProps<T extends IReorderableItem> {
  items: T[];
  directoryId: string;
  itemType: ReorderableDirectoryItemType;
  renderItem: (item: T) => React.ReactNode;
  leadingContent?: React.ReactNode;
  gap?: number;
}

interface ISortableRowProps {
  id: string;
  children: React.ReactNode;
  suppressClickRef: React.MutableRefObject<boolean>;
}

const SortableRow: React.FC<ISortableRowProps> = ({
  id,
  children,
  suppressClickRef,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'touch-none',
        isDragging && 'opacity-50',
        'cursor-grab active:cursor-grabbing',
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

function splitPendingItems<T extends IReorderableItem>(
  items: T[],
): { pinned: T[]; sortable: T[] } {
  const pinned = items.filter((item) => item.generationStatus === 'pending');
  const sortable = items.filter((item) => item.generationStatus !== 'pending');
  return { pinned, sortable };
}

export function SortableDirectoryList<T extends IReorderableItem>({
  items,
  directoryId,
  itemType,
  renderItem,
  leadingContent,
  gap = 8,
}: ISortableDirectoryListProps<T>): React.JSX.Element {
  const [activeId, setActiveId] = useState<string | null>(null);
  const suppressClickRef = useRef(false);
  const [reorderDirectoryItems] = useReorderDirectoryItemsMutation();

  const { pinned, sortable } = useMemo(() => splitPendingItems(items), [items]);
  const sortableIds = useMemo(
    () => sortable.map((item) => item.id),
    [sortable],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const activeItem = useMemo(
    () => sortable.find((item) => item.id === activeId) ?? null,
    [activeId, sortable],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = sortableIds.indexOf(String(active.id));
      const newIndex = sortableIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const nextOrder = arrayMove(sortable, oldIndex, newIndex);
      const orderedSourceIds = nextOrder.map((item) => item.id);

      suppressClickRef.current = true;
      void reorderDirectoryItems({
        directoryId,
        itemType,
        orderedSourceIds,
      });
    },
    [directoryId, itemType, reorderDirectoryItems, sortable, sortableIds],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  return (
    <div className="flex flex-col" style={{ gap }}>
      {leadingContent}
      {pinned.map((item) => (
        <div key={item.id}>{renderItem(item)}</div>
      ))}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col" style={{ gap }}>
            {sortable.map((item) => (
              <SortableRow
                key={item.id}
                id={item.id}
                suppressClickRef={suppressClickRef}
              >
                {renderItem(item)}
              </SortableRow>
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div className="cursor-grabbing shadow-lg rounded-lg opacity-95">
              {renderItem(activeItem)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
