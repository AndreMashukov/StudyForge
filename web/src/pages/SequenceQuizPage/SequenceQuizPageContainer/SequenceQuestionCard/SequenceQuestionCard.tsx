import React from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { GripVertical, X, Package, Layers, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../../../lib/utils';
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
        'bg-[#1c1c1e] transition-colors duration-150 select-none',
        isDragging ? 'opacity-40' : 'opacity-100',
        !isChecked && 'cursor-grab active:cursor-grabbing',
        isChecked && 'cursor-default',
        !isChecked && 'hover:border-primary/60 hover:bg-primary/5',
        isChecked && isPositionCorrect === true && 'border-green-500/60 bg-green-500/8',
        isChecked && isPositionCorrect === false && 'border-destructive/60 bg-destructive/8',
        !isChecked && 'border-[#27272a]'
      )}
    >
      <span
        {...attributes}
        {...listeners}
        className={cn(
          'text-muted-foreground shrink-0',
          isChecked ? 'opacity-30' : 'opacity-60 hover:opacity-100'
        )}
        aria-label="Drag handle"
      >
        <GripVertical size={16} />
      </span>

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  // Prefix IDs to avoid collisions between the two zones
  const sourceIds = availableItems.map((item) => `src__${item}`);
  const targetIds = placedItems.map((item) => `tgt__${item}`);

  const itemFromId = (id: UniqueIdentifier): string => {
    const s = String(id);
    if (s.startsWith('src__')) return s.slice(5);
    if (s.startsWith('tgt__')) return s.slice(5);
    return s;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    const fromSource = activeIdStr.startsWith('src__');
    const toTarget =
      overIdStr.startsWith('tgt__') || overIdStr === TARGET_ZONE;
    const toSource =
      overIdStr.startsWith('src__') || overIdStr === SOURCE_ZONE;

    if (fromSource && toTarget) {
      const item = itemFromId(active.id);
      if (!placedItems.includes(item)) {
        handlers.handlePlaceItem(item);
      }
    } else if (!fromSource && toSource) {
      const item = itemFromId(active.id);
      if (placedItems.includes(item)) {
        handlers.handleRemoveItem(item);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    const fromTarget = activeIdStr.startsWith('tgt__');
    const toTarget =
      overIdStr.startsWith('tgt__') || overIdStr === TARGET_ZONE;

    if (fromTarget && toTarget && overIdStr.startsWith('tgt__')) {
      const fromIndex = placedItems.indexOf(itemFromId(active.id));
      const toIndex = placedItems.indexOf(itemFromId(over.id));
      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        handlers.handleReorderPlacedItem(fromIndex, toIndex);
      }
    }
  };

  const activeItemText = activeId ? itemFromId(activeId) : null;

  return (
    <div className="bg-[#111111] border border-[#27272a] rounded-xl p-6 space-y-4">
      {/* Question label + text */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-1">
          Question
        </p>
        <h3 className="text-lg font-semibold leading-snug">{question.question}</h3>
      </div>

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
              <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#27272a] text-muted-foreground">
                {availableItems.length}
              </span>
            </div>
            <SortableContext items={sourceIds} strategy={verticalListSortingStrategy} id={SOURCE_ZONE}>
              <div
                className={cn(
                  'min-h-[140px] border-2 border-dashed rounded-lg p-2 space-y-1.5 transition-colors',
                  availableItems.length === 0
                    ? 'border-[#27272a]/50'
                    : 'border-[#27272a]'
                )}
              >
                {availableItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-1 text-muted-foreground opacity-40 py-6">
                    <Package size={20} />
                    <span className="text-xs">All blocks placed</span>
                  </div>
                ) : (
                  availableItems.map((item) => (
                    <SortableBlock
                      key={`src__${item}`}
                      id={`src__${item}`}
                      text={item}
                      inTarget={false}
                      isChecked={isChecked}
                    />
                  ))
                )}
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
            <SortableContext items={targetIds} strategy={verticalListSortingStrategy} id={TARGET_ZONE}>
              <div
                className={cn(
                  'min-h-[140px] border-2 border-dashed rounded-lg p-2 space-y-1.5 transition-colors',
                  placedItems.length === 0
                    ? 'border-primary/20'
                    : 'border-primary/30'
                )}
              >
                {placedItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-1 text-muted-foreground opacity-40 py-6">
                    <Layers size={20} />
                    <span className="text-xs">Drag blocks here</span>
                  </div>
                ) : (
                  placedItems.map((item, index) => {
                    const isPositionCorrect = isChecked
                      ? question.items[index] === item
                      : null;
                    return (
                      <SortableBlock
                        key={`tgt__${item}`}
                        id={`tgt__${item}`}
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
              </div>
            </SortableContext>
          </div>
        </div>

        <DragOverlay>
          {activeId && activeItemText ? (
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium',
                'bg-[#1c1c1e] border-primary shadow-lg shadow-primary/20',
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
          <button
            type="button"
            onClick={handlers.handleResetBoard}
            className="text-xs px-3 py-1.5 rounded-md border border-[#27272a] text-muted-foreground hover:text-foreground hover:bg-[#27272a] transition-colors"
          >
            Reset
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={handlers.handleCheckAnswer}
            disabled={placedItems.length !== question.items.length}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              placedItems.length === question.items.length
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-primary/30 text-primary-foreground/50 cursor-not-allowed'
            )}
          >
            Check Order
          </button>
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
            <div className="pt-2 border-t border-white/8">
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
            <button
              type="button"
              onClick={isLastQuestion ? handlers.handleCompleteQuiz : handlers.handleNextQuestion}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {isLastQuestion ? 'View results' : 'Next question →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
