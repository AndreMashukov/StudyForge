import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Eye, ListOrdered } from 'lucide-react';
import { QuizAnswerValue, StatisticsRecentFailure } from '@shared-types';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card, CardContent } from '../../../../components/ui/Card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/Dialog';
import { MermaidDiagram } from '../../../../components/MermaidDiagram';
import {
  detailQuizPath,
  formatDateTime,
  quizTypeLabel,
} from '../../utils/statisticsPageUtils';
import { EmptyState } from '../StatisticsShared/StatisticsShared';

type FailureComparisonState =
  | {
      kind: 'diagram';
      questionText: string;
      selectedCode: string;
      correctCode: string;
    }
  | {
      kind: 'sequence';
      questionText: string;
      selectedItems: string[];
      correctItems: string[];
    };

const SEQUENCE_ITEM_SEPARATOR = ' → ';

function isDiagramQuiz(quizType: string | undefined): boolean {
  return quizType === 'diagramQuiz';
}

function isSequenceQuiz(quizType: string | undefined): boolean {
  return quizType === 'sequenceQuiz';
}

function isStringArray(value: QuizAnswerValue): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function splitSequenceLabel(label: string): string[] {
  return label
    .split(SEQUENCE_ITEM_SEPARATOR)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function resolveSequenceItems(value: QuizAnswerValue, labelFallback: string): string[] {
  if (isStringArray(value)) return value;
  return splitSequenceLabel(labelFallback);
}

function canOpenDiagramComparison(failure: StatisticsRecentFailure): boolean {
  return Boolean(failure.selectedDiagramCode && failure.correctDiagramCode);
}

interface ISequenceListProps {
  items: string[];
  tone: 'wrong' | 'right';
}

const SequenceList = ({ items, tone }: ISequenceListProps) => (
  <ol className="space-y-2 text-sm">
    {items.map((item, index) => (
      <li
        key={`${tone}-${index}-${item}`}
        className={
          tone === 'wrong'
            ? 'flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2'
            : 'flex items-start gap-3 rounded-md border border-success/40 bg-success/10 px-3 py-2'
        }
      >
        <span
          className={
            tone === 'wrong'
              ? 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-xs font-semibold text-destructive'
              : 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-xs font-semibold text-success'
          }
        >
          {index + 1}
        </span>
        <span className="text-foreground">{item}</span>
      </li>
    ))}
  </ol>
);

export const FailureList = ({ failures }: { failures: StatisticsRecentFailure[] }) => {
  const [openComparison, setOpenComparison] = useState<FailureComparisonState | null>(null);

  if (failures.length === 0) {
    return (
      <EmptyState
        title="No failed answers in this range"
        description="Quiz misses will appear here after completed attempts."
      />
    );
  }

  const handleOpenComparison = (failure: StatisticsRecentFailure) => {
    if (isDiagramQuiz(failure.quizType)) {
      const selectedCode = failure.selectedDiagramCode;
      const correctCode = failure.correctDiagramCode;
      if (!selectedCode || !correctCode) return;
      setOpenComparison({
        kind: 'diagram',
        questionText: failure.questionText,
        selectedCode,
        correctCode,
      });
      return;
    }
    if (isSequenceQuiz(failure.quizType)) {
      setOpenComparison({
        kind: 'sequence',
        questionText: failure.questionText,
        selectedItems: resolveSequenceItems(failure.selectedAnswer, failure.selectedAnswerLabel),
        correctItems: resolveSequenceItems(failure.correctAnswer, failure.correctAnswerLabel),
      });
    }
  };

  const handleClose = () => setOpenComparison(null);

  return (
    <div className="space-y-3">
      {failures.map((failure) => {
        const isDiagram = isDiagramQuiz(failure.quizType);
        const isSequence = isSequenceQuiz(failure.quizType);
        const showRichAnswer = isDiagram || isSequence;
        const canOpenComparison = isDiagram ? canOpenDiagramComparison(failure) : isSequence;

        return (
          <Card key={failure.id}>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{quizTypeLabel(failure.quizType)}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(failure.occurredAt)}</span>
                    {failure.repeatedFailureCount > 1 && (
                      <Badge variant="outline">{failure.repeatedFailureCount} repeats</Badge>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{failure.questionText}</h3>
                  {showRichAnswer ? (
                    <div className="mt-3 rounded-md border border-dashed border-border bg-muted/20 p-3">
                      <p className="text-xs uppercase text-muted-foreground">Comparison</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => handleOpenComparison(failure)}
                        disabled={!canOpenComparison}
                        aria-label={
                          isDiagram ? 'View diagram comparison' : 'View sequence comparison'
                        }
                      >
                        {isDiagram ? (
                          <Eye className="mr-2 h-4 w-4" />
                        ) : (
                          <ListOrdered className="mr-2 h-4 w-4" />
                        )}
                        {isDiagram ? 'View diagram' : 'View sequence'}
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                      <div className="rounded-md bg-destructive/10 p-3">
                        <p className="text-xs uppercase text-muted-foreground">Your answer</p>
                        <p className="mt-1 text-destructive">{failure.selectedAnswerLabel}</p>
                      </div>
                      <div className="rounded-md bg-accent/10 p-3">
                        <p className="text-xs uppercase text-muted-foreground">Correct answer</p>
                        <p className="mt-1 text-foreground">{failure.correctAnswerLabel}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 md:w-48">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={detailQuizPath(failure.quizType, failure.quizId)}>Quiz detail</Link>
                  </Button>
                  {failure.sourceDocuments.slice(0, 1).map((document) => (
                    <Button key={document.id} variant="ghost" size="sm" asChild>
                      <Link to={`/document/${document.id}`}>
                        <BookOpen className="mr-2 h-4 w-4" />
                        Source
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog
        open={openComparison !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleClose();
        }}
      >
        <DialogContent className="max-w-4xl">
          {openComparison && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {openComparison.kind === 'diagram' ? 'Diagram comparison' : 'Sequence comparison'}
                </DialogTitle>
                <DialogDescription>{openComparison.questionText}</DialogDescription>
              </DialogHeader>
              <DialogBody>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-destructive">Your answer</p>
                    {openComparison.kind === 'diagram' ? (
                      <div className="space-y-3">
                        <MermaidDiagram code={openComparison.selectedCode} className="min-h-[200px]" />
                        <details className="rounded-md border border-border bg-muted/20 p-3">
                          <summary className="cursor-pointer text-sm font-medium">Show source</summary>
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-foreground">
                            {openComparison.selectedCode}
                          </pre>
                        </details>
                      </div>
                    ) : (
                      <SequenceList items={openComparison.selectedItems} tone="wrong" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-success">Correct answer</p>
                    {openComparison.kind === 'diagram' ? (
                      <div className="space-y-3">
                        <MermaidDiagram code={openComparison.correctCode} className="min-h-[200px]" />
                        <details className="rounded-md border border-border bg-muted/20 p-3">
                          <summary className="cursor-pointer text-sm font-medium">Show source</summary>
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-foreground">
                            {openComparison.correctCode}
                          </pre>
                        </details>
                      </div>
                    ) : (
                      <SequenceList items={openComparison.correctItems} tone="right" />
                    )}
                  </div>
                </div>
              </DialogBody>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
