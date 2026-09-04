import React from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { useState, ReactNode } from 'react';
import { useSelector } from 'react-redux';
import {
  GripVertical,
  X,
  Package,
  Table2,
  CheckCircle,
  XCircle,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Spinner } from '../../../../components/ui/Spinner';
import { QuizQuestionHeader } from '../../../../components/QuizQuestionHeader';
import {
  selectMatchQuizState,
  selectMatchQuizProgress,
} from '../../../../store/slices/matchQuizPageSlice';
import { IMatchQuizViewQuestion } from '../../../../store/slices/matchQuizPageSlice';
import { IMatchQuizPageHandlers } from '../../types/IMatchQuizPageHandlers';

interface IMatchQuestionCardProps {
  question: IMatchQuizViewQuestion;
  bankOptionIds: string[];
  placements: Record<string, string>;
  lockedPromptIds: string[];
  isChecked: boolean;
  isCorrect: boolean | null;
  showExplanation: boolean;
  handlers: IMatchQuizPageHandlers;
  isLastQuestion: boolean;
  backAction?: ReactNode;
}

interface IDragPayload {
  optionId: string;
  fromPromptId: string | null;
}

const BANK_ZONE = 'bank-zone';

function optionById(question: IMatchQuizViewQuestion, optionId: string) {
  return question.options.find((option) => option.id === optionId) ?? null;
}

function correctOptionIdFor(
  question: IMatchQuizViewQuestion,
  promptId: string,
): string | null {
  const option = question.options.find(
    (candidate) => candidate.correctPromptId === promptId,
  );
  return option ? option.id : null;
}

interface IDraggableChipProps {
  optionId: string;
  text: string;
  disabled: boolean;
  fromPromptId: string | null;
  overlay?: boolean;
}

function readFromPromptId(data: unknown): string | null {
  if (!data || typeof data !== 'object' || !('fromPromptId' in data)) {
    return null;
  }
  const value = data.fromPromptId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

const DraggableChip: React.FC<IDraggableChipProps> = ({
  optionId,
  text,
  disabled,
  fromPromptId,
  overlay = false,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: optionId,
    disabled,
    data: { fromPromptId },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role={disabled ? undefined : 'button'}
      aria-label={disabled ? undefined : `Drag chip "${text}"`}
      aria-roledescription={disabled ? undefined : 'draggable'}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium',
        'bg-card transition-colors duration-150 select-none',
        overlay
          ? 'border-primary shadow-lg shadow-primary/20 opacity-95 cursor-grabbing'
          : '',
        !overlay && isDragging ? 'opacity-40' : 'opacity-100',
        !disabled &&
          !overlay &&
          'cursor-grab active:cursor-grabbing hover:border-primary/60 hover:bg-primary/5',
        disabled && !overlay && 'cursor-default border-border',
        !overlay && 'border-border',
      )}
    >
      <GripVertical
        size={14}
        className={cn(
          'shrink-0 text-muted-foreground',
          disabled ? 'opacity-30 cursor-default' : 'opacity-60',
        )}
        aria-hidden="true"
      />
      <span className="leading-snug">{text}</span>
    </div>
  );
};

interface IDroppableAreaProps {
  id: string;
  children: ReactNode;
  className?: string;
}

const DroppableArea: React.FC<IDroppableAreaProps> = ({
  id,
  children,
  className,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        isOver && 'ring-2 ring-primary/50 ring-offset-1',
      )}
    >
      {children}
    </div>
  );
};

interface IMatchPromptRowProps {
  promptId: string;
  promptText: string;
  rowIndex: number;
  question: IMatchQuizViewQuestion;
  placements: Record<string, string>;
  isLocked: boolean;
  onRemove: (promptId: string) => void;
}

const PromptRow: React.FC<IMatchPromptRowProps> = ({
  promptId,
  promptText,
  rowIndex,
  question,
  placements,
  isLocked,
  onRemove,
}) => {
  const placedOptionId = placements[promptId] ?? null;
  const placedOption = placedOptionId
    ? optionById(question, placedOptionId)
    : null;
  const isRowCorrect =
    isLocked && placedOptionId === correctOptionIdFor(question, promptId);

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-stretch border rounded-lg overflow-hidden',
        isLocked && isRowCorrect && 'border-success/60 bg-success/8',
        !isLocked && 'border-border',
      )}
    >
      <div className="flex-1 px-4 py-3 text-sm leading-snug bg-muted/30">
        <span className="text-xs font-bold text-muted-foreground mr-2">
          {rowIndex + 1}.
        </span>
        {promptText}
      </div>
      <DroppableArea
        id={`row__${promptId}`}
        className={cn(
          'sm:w-56 shrink-0 min-h-[52px] border-t sm:border-t-0 sm:border-l border-dashed flex items-center px-2 py-1.5',
          isLocked ? 'border-border/40' : 'border-border/60',
        )}
      >
        {placedOption ? (
          isLocked ? (
            <div
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium w-full',
                isRowCorrect
                  ? 'border-success/60 bg-success/8'
                  : 'border-destructive/60 bg-destructive/8',
              )}
            >
              <span className="flex-1 leading-snug">{placedOption.text}</span>
              {isRowCorrect ? (
                <CheckCircle size={14} className="shrink-0 text-success" />
              ) : (
                <XCircle size={14} className="shrink-0 text-destructive" />
              )}
            </div>
          ) : (
            <DraggableChip
              optionId={placedOptionId}
              text={placedOption.text}
              disabled={false}
              fromPromptId={promptId}
            />
          )
        ) : (
          <span className="text-xs text-muted-foreground px-2">
            Drag a chip here
          </span>
        )}
        {!isLocked && placedOptionId && !placedOption && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(promptId)}
            className="shrink-0 h-5 w-5 rounded-full bg-destructive/15 text-destructive hover:bg-destructive/30"
            aria-label="Remove placed option"
          >
            <X size={11} />
          </Button>
        )}
      </DroppableArea>
    </div>
  );
};

export const MatchQuestionCard: React.FC<IMatchQuestionCardProps> = ({
  question,
  bankOptionIds,
  placements,
  lockedPromptIds,
  isCorrect,
  showExplanation,
  handlers,
  isLastQuestion,
  backAction,
}) => {
  const [activeDrag, setActiveDrag] = useState<IDragPayload | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const quizState = useSelector(selectMatchQuizState);
  const progress = useSelector(selectMatchQuizProgress);
  const currentQuestionNumber = quizState.currentQuestionIndex + 1;
  const totalQuestions = quizState.questions.length;
  const answeredCount = quizState.answers.length;
  const isFollowupGenerated =
    !!quizState.followupGenerated[quizState.currentQuestionIndex];

  const promptIds = question.prompts.map((prompt) => prompt.id);
  const allPlaced = promptIds.every((promptId) => placements[promptId]);
  const bankOptions = bankOptionIds
    .map((optionId) => optionById(question, optionId))
    .filter((option): option is NonNullable<typeof option> => option !== null);

  const handleDragStart = (event: DragStartEvent) => {
    const optionId = String(event.active.id);
    const fromPromptId = readFromPromptId(event.active.data.current);
    setActiveDrag({ optionId, fromPromptId });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const active = activeDrag;
    setActiveDrag(null);
    const { over } = event;
    if (!over || !active) return;

    const overId = String(over.id);

    if (overId === BANK_ZONE) {
      if (active.fromPromptId) {
        handlers.handleRemoveOption(active.fromPromptId);
      }
      return;
    }

    if (!overId.startsWith('row__')) return;
    const targetPromptId = overId.slice(5);
    if (!promptIds.includes(targetPromptId)) return;

    if (active.fromPromptId === targetPromptId) return;

    if (active.fromPromptId) {
      handlers.handleRemoveOption(active.fromPromptId);
    }
    handlers.handlePlaceOption(targetPromptId, active.optionId);
  };

  const activeOption = activeDrag
    ? optionById(question, activeDrag.optionId)
    : null;

  return (
    <Card className="overflow-hidden">
      <QuizQuestionHeader
        progress={progress}
        currentQuestion={currentQuestionNumber}
        totalQuestions={totalQuestions}
        score={quizState.score}
        answeredCount={answeredCount}
        questionText={question.question}
        hint={question.hint}
        leadingAction={backAction}
      />

      <CardContent className="space-y-3">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Chip bank */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 px-0.5">
              <Package size={13} />
              <span>Options</span>
              <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {bankOptionIds.length} left
              </span>
            </div>
            <DroppableArea
              id={BANK_ZONE}
              className={cn(
                'min-h-[64px] border-2 border-dashed rounded-lg p-2.5 flex flex-wrap gap-2 transition-colors',
                bankOptionIds.length === 0
                  ? 'border-border/50'
                  : 'border-border',
              )}
            >
              {bankOptionIds.length === 0 ? (
                <div className="w-full flex items-center justify-center gap-1 text-muted-foreground opacity-40 py-3">
                  <Package size={18} />
                  <span className="text-xs">All options placed</span>
                </div>
              ) : (
                bankOptions.map((option) => (
                  <DraggableChip
                    key={option.id}
                    optionId={option.id}
                    text={option.text}
                    disabled={isCorrect === true}
                    fromPromptId={null}
                  />
                ))
              )}
            </DroppableArea>
          </div>

          {/* Match table */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary mb-1.5 px-0.5">
              <Table2 size={13} />
              <span>Match Table</span>
              <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                {Object.keys(placements).length} / {promptIds.length}
              </span>
            </div>
            <div className="space-y-2">
              {question.prompts.map((prompt, index) => (
                <PromptRow
                  key={prompt.id}
                  promptId={prompt.id}
                  promptText={prompt.text}
                  rowIndex={index}
                  question={question}
                  placements={placements}
                  isLocked={lockedPromptIds.includes(prompt.id)}
                  onRemove={handlers.handleRemoveOption}
                />
              ))}
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeOption ? (
              <DraggableChip
                optionId={activeOption.id}
                text={activeOption.text}
                disabled={false}
                fromPromptId={null}
                overlay={true}
              />
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Actions */}
        {!isCorrect && !showExplanation && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handlers.handleResetBoard}
            >
              <RotateCcw size={14} className="mr-1.5" />
              Reset
            </Button>
            <span className="flex-1" />
            <Button onClick={handlers.handleCheckAnswer} disabled={!allPlaced}>
              Submit
            </Button>
          </div>
        )}

        {/* Explanation */}
        {showExplanation && (
          <div
            className={cn(
              'rounded-lg p-4 text-sm space-y-2',
              isCorrect
                ? 'bg-success/8 border border-success/25'
                : 'bg-destructive/8 border border-destructive/25',
            )}
          >
            <p
              className={cn(
                'font-bold flex items-center gap-1.5',
                isCorrect ? 'text-success' : 'text-destructive',
              )}
            >
              {isCorrect ? (
                <>
                  <CheckCircle size={15} /> Correct! All pairs matched.
                </>
              ) : (
                <>
                  <XCircle size={15} /> Not quite — wrong matches returned to
                  the bank.
                </>
              )}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {question.explanation}
            </p>

            {!isCorrect && (
              <div className="pt-2 border-t border-border/40">
                <p className="text-xs font-semibold text-foreground mb-2">
                  Correct matches:
                </p>
                <div className="space-y-1">
                  {question.prompts.map((prompt) => {
                    const option = question.options.find(
                      (candidate) => candidate.correctPromptId === prompt.id,
                    );
                    return (
                      <div
                        key={prompt.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <CheckCircle
                          size={12}
                          className="shrink-0 text-success"
                        />
                        <span className="text-muted-foreground">
                          {prompt.text}{' '}
                          <span className="text-foreground font-semibold">
                            {option ? option.text : ''}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {quizState.followupError && (
              <p className="text-xs text-destructive">
                {quizState.followupError}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <Button
                onClick={handlers.handleGenerateFollowup}
                variant="outline"
                size="sm"
                className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary disabled:border-border disabled:bg-muted/40 disabled:text-muted-foreground"
                disabled={isFollowupGenerated || quizState.isGeneratingFollowup}
              >
                {quizState.isGeneratingFollowup ? (
                  <>
                    <Spinner size="xs" className="mr-2" />
                    Generating...
                  </>
                ) : isFollowupGenerated ? (
                  <>
                    <CheckCircle size={14} className="mr-1.5" />
                    Explanation ready
                  </>
                ) : (
                  <>
                    <Sparkles size={14} className="mr-1.5" />
                    Detailed explanation
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={
                  isCorrect
                    ? isLastQuestion
                      ? handlers.handleCompleteQuiz
                      : handlers.handleNextQuestion
                    : handlers.handleRetryAfterCheck
                }
              >
                {isCorrect
                  ? isLastQuestion
                    ? 'View results'
                    : 'Next question'
                  : 'Try again'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
