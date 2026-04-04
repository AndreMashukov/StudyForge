import React from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  UniqueIdentifier,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useRef, useLayoutEffect } from 'react';
import { GripVertical, X, Package, Layers, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { ISequenceQuizQuestion } from '../../types/ISequenceQuizTypes';
import { ISequenceQuizPageHandlers } from '../../types/ISequenceQuizPageHandlers';

interface ISequenceQuestionCardProps {
  question: ISequenceQuizQuestion;
  availableItems: string[];
  placedItems: string[];
  isChecked: boolean;
  isCorrect: boolean | null;
  showExplanation: boolean;
  handlers: ISequenceQuizPageHandlers;
  isLastQuestion: boolean;
}

// Droppable zone IDs
const SOURCE_ZONE = 'source-zone';
const TARGET_ZONE = 'target-zone';

interface ISortableBlockProps {
  id: string;
  text: string;
  index?: number;
  inTarget: boolean;
  isChecked: boolean;
  isPositionCorrect?: boolean | null;
  onRemove?: () => void;
}

const SortableBlock = ({
  id,
  text,
  index,
  inTarget,
  isChecked,
  isPositionCorrect,
  onRemove,
}: ISortableBlockProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: isChecked,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium',
        'bg-card transition-colors duration-150 select-none',
        isDragging ? 'opacity-40' : 'opacity-100',
        !isChecked && 'cursor-grab active:cursor-grabbing',
        isChecked && 'cursor-default',
        !isChecked && 'hover:border-primary/60 hover:bg-primary/5',
        isChecked && isPositionCorrect === true && 'border-green-500/60 bg-green-500/8',
        isChecked && isPositionCorrect === false && 'border-destructive/60 bg-destructive/8',
        !isChecked && 'border-border'
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className={cn(
          'text-muted-foreground shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded',
          isChecked ? 'opacity-30 cursor-default' : 'opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing'
        )}
        aria-label={`Drag handle for "${text}"`}
        aria-roledescription="sortable"
        tabIndex={isChecked ? -1 : 0}
      >
        <GripVertical size={16} />
      </button>

      {inTarget && (
        <span
          className={cn(
            'w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0',
            isChecked && isPositionCorrect === true && 'bg-green-500 text-black',
            isChecked && isPositionCorrect === false && 'bg-destructive text-white',
            !isChecked && 'bg-primary/20 text-primary'
          )}
        >
          {index !== undefined ? index + 1 : ''}
        </span>
      )}

      <span className="flex-1 leading-snug">{text}</span>

      {inTarget && !isChecked && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 w-5 h-5 rounded-full bg-destructive/15 text-destructive flex items-center justify-center hover:bg-destructive/30 transition-colors"
          aria-label={`Remove "${text}"`}
        >
          <X size={11} />
        </button>
      )}

      {isChecked && inTarget && isPositionCorrect === true && (
        <CheckCircle size={14} className="shrink-0 text-green-500" />
      )}
      {isChecked && inTarget && isPositionCorrect === false && (
        <XCircle size={14} className="shrink-0 text-destructive" />
      )}
    </div>
  );
};

interface IDroppableZoneProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const DroppableZone: React.FC<IDroppableZoneProps> = ({ id, children, className, style }) => {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className} style={style}>
      {children}
    </div>
  );
};

export const SequenceQuestionCard: React.FC<ISequenceQuestionCardProps> = ({
  question,
  availableItems,
  placedItems,
  isChecked,
  isCorrect,
  showExplanation,
  handlers,
  isLastQuestion,
}) => {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  // Live ordered copy of placedItems updated during drag for smooth reorder preview
  const [liveTargetIds, setLiveTargetIds] = useState<string[]>([]);

  // Measure the source zone's natural height on first render (before any items are moved)
  // so both zones share the same fixed height regardless of text wrapping.
  const sourceZoneMeasureRef = useRef<HTMLDivElement>(null);
  const [fixedHeight, setFixedHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (sourceZoneMeasureRef.current && fixedHeight === null) {
      setFixedHeight(sourceZoneMeasureRef.current.offsetHeight);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoneStyle = fixedHeight !== null ? { height: fixedHeight } : undefined;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sourceIds = availableItems.map((_, i) => `src__${i}`);
  // Use the live order during drag, fall back to Redux state otherwise
  const targetIds = activeId ? liveTargetIds : placedItems.map((_, i) => `tgt__${i}`);

  const itemFromSourceId = (id: UniqueIdentifier): { item: string; index: number } | null => {
    const s = String(id);
    if (s.startsWith('src__')) {
      const idx = parseInt(s.slice(5), 10);
      if (idx >= 0 && idx < availableItems.length) return { item: availableItems[idx], index: idx };
    }
    return null;
  };

  const itemFromTargetId = (id: UniqueIdentifier): { item: string; index: number } | null => {
    const s = String(id);
    if (s.startsWith('tgt__')) {
      const idx = parseInt(s.slice(5), 10);
      if (idx >= 0 && idx < placedItems.length) return { item: placedItems[idx], index: idx };
    }
    return null;
  };

  const itemTextFromId = (id: UniqueIdentifier): string | null => {
    const src = itemFromSourceId(id);
    if (src) return src.item;
    const tgt = itemFromTargetId(id);
    if (tgt) return tgt.item;
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
    // Snapshot current target ids for live reorder tracking
    setLiveTargetIds(placedItems.map((_, i) => `tgt__${i}`));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    const fromTarget = activeIdStr.startsWith('tgt__');
    const toTarget = overIdStr.startsWith('tgt__');

    // Live reorder within target zone: shift items as the drag moves
    if (fromTarget && toTarget && activeIdStr !== overIdStr) {
      setLiveTargetIds((ids) => {
        const oldIndex = ids.indexOf(activeIdStr);
        const newIndex = ids.indexOf(overIdStr);
        if (oldIndex === -1 || newIndex === -1) return ids;
        return arrayMove(ids, oldIndex, newIndex);
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    const fromSource = activeIdStr.startsWith('src__');
    const fromTarget = activeIdStr.startsWith('tgt__');
    const toTarget = overIdStr.startsWith('tgt__') || overIdStr === TARGET_ZONE;
    const toSource = overIdStr.startsWith('src__') || overIdStr === SOURCE_ZONE;

    if (fromSource && toTarget) {
      const src = itemFromSourceId(active.id);
      if (src) {
        if (overIdStr === TARGET_ZONE) {
          // Dropped on empty zone area — append to end
          handlers.handlePlaceItem(src.item);
        } else {
          // Dropped on a specific item — insert after it so it lands below
          const overTgt = itemFromTargetId(over.id);
          handlers.handlePlaceItem(src.item, overTgt !== null ? overTgt.index + 1 : undefined);
        }
      }
    } else if (fromTarget && toSource) {
      const tgt = itemFromTargetId(active.id);
      if (tgt) {
        handlers.handleRemoveItem(tgt.item);
      }
    } else if (fromTarget && toTarget) {
      // Commit the live reorder to Redux using the liveTargetIds order
      const newOrder = liveTargetIds.map((id) => {
        const t = itemFromTargetId(id);
        return t ? t.item : null;
      }).filter((x): x is string => x !== null);

      // Walk through newOrder and apply any moves that differ from current placedItems
      const oldFirst = itemFromTargetId(active.id);
      const newFirstIdx = liveTargetIds.indexOf(activeIdStr);
      if (oldFirst !== null && newFirstIdx !== -1 && oldFirst.index !== newFirstIdx) {
        handlers.handleReorderPlacedItem(oldFirst.index, newFirstIdx);
      }
      // If identical, no-op
      void newOrder;
    }
  };

  const activeItemText = activeId ? itemTextFromId(activeId) : null;

  return (
    <Card>
      <CardHeader>
        <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-1">
          Question
        </p>
        <CardTitle className="text-lg font-semibold leading-snug">{question.question}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source pool */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 px-0.5">
              <Package size={13} />
              <span>Available Blocks</span>
              <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {availableItems.length}
              </span>
            </div>
            <SortableContext items={sourceIds} strategy={verticalListSortingStrategy}>
              <div ref={sourceZoneMeasureRef}>
              <DroppableZone
                id={SOURCE_ZONE}
                className={cn(
                  'border-2 border-dashed rounded-lg p-2 space-y-1.5 transition-colors overflow-y-auto',
                  availableItems.length === 0
                    ? 'border-border/50'
                    : 'border-border'
                )}
                style={zoneStyle}
              >
                {availableItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-1 text-muted-foreground opacity-40 py-6">
                    <Package size={20} />
                    <span className="text-xs">All blocks placed</span>
                  </div>
                ) : (
                  availableItems.map((item, i) => (
                    <SortableBlock
                      key={`src__${i}`}
                      id={`src__${i}`}
                      text={item}
                      inTarget={false}
                      isChecked={isChecked}
                    />
                  ))
                )}
              </DroppableZone>
              </div>
            </SortableContext>
          </div>

          {/* Target sequence board */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary mb-2 px-0.5">
              <Layers size={13} />
              <span>Your Sequence</span>
              <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                {placedItems.length} / {question.items.length}
              </span>
            </div>
            <SortableContext items={targetIds} strategy={verticalListSortingStrategy}>
              <DroppableZone
                id={TARGET_ZONE}
                className={cn(
                  'border-2 border-dashed rounded-lg p-2 space-y-1.5 transition-colors overflow-y-auto',
                  placedItems.length === 0
                    ? 'border-primary/20'
                    : 'border-primary/30'
                )}
                style={zoneStyle}
              >
                {placedItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-1 text-muted-foreground opacity-40 py-6">
                    <Layers size={20} />
                    <span className="text-xs">Drag blocks here</span>
                  </div>
                ) : (
                  (activeId ? liveTargetIds : placedItems.map((_, i) => `tgt__${i}`)).map((tgtId, index) => {
                    const srcIndex = parseInt(String(tgtId).slice(5), 10);
                    const item = placedItems[srcIndex] ?? '';
                    const isPositionCorrect = isChecked
                      ? question.items[index] === item
                      : null;
                    return (
                      <SortableBlock
                        key={tgtId}
                        id={String(tgtId)}
                        text={item}
                        index={index}
                        inTarget={true}
                        isChecked={isChecked}
                        isPositionCorrect={isPositionCorrect}
                        onRemove={() => handlers.handleRemoveItem(item)}
                      />
                    );
                  })
                )}
              </DroppableZone>
            </SortableContext>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeId && activeItemText ? (
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium',
                'bg-card border-primary shadow-lg shadow-primary/20',
                'opacity-95 cursor-grabbing'
              )}
            >
              <GripVertical size={16} className="text-muted-foreground" />
              <span>{activeItemText}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Actions */}
      {!isChecked && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handlers.handleResetBoard}
          >
            Reset
          </Button>
          <span className="flex-1" />
          <Button
            onClick={handlers.handleCheckAnswer}
            disabled={placedItems.length !== question.items.length}
          >
            Check Order
          </Button>
        </div>
      )}

      {/* Explanation */}
      {showExplanation && (
        <div
          className={cn(
            'rounded-lg p-4 text-sm space-y-2',
            isCorrect
              ? 'bg-green-500/8 border border-green-500/25'
              : 'bg-destructive/8 border border-destructive/25'
          )}
        >
          <p
            className={cn(
              'font-bold flex items-center gap-1.5',
              isCorrect ? 'text-green-500' : 'text-destructive'
            )}
          >
            {isCorrect ? (
              <><CheckCircle size={15} /> Correct! Perfect order.</>
            ) : (
              <><XCircle size={15} /> Incorrect — some items are out of order.</>
            )}
          </p>
          <p className="text-muted-foreground leading-relaxed">{question.explanation}</p>

          {!isCorrect && (
            <div className="pt-2 border-t border-border/40">
              <p className="text-xs font-semibold text-foreground mb-2">Correct order:</p>
              <div className="space-y-1">
                {question.items.map((item, i) => (
                  <div key={item} className="flex items-center gap-2 text-xs">
                    <span className="w-4 h-4 rounded-full bg-green-500/20 text-green-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              onClick={isLastQuestion ? handlers.handleCompleteQuiz : handlers.handleNextQuestion}
            >
              {isLastQuestion ? 'View results' : 'Next question →'}
            </Button>
          </div>
        </div>
      )}
      </CardContent>
    </Card>
  );
};
