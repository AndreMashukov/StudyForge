import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Trash2 } from 'lucide-react';
import { HideStatisticsFailureRequest, StatisticsFlashcardFailure } from '@shared-types';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card, CardContent } from '../../../../components/ui/Card';
import { VirtualizedList } from '../../../../components/VirtualizedList';
import { formatDateTime } from '../../utils/statisticsPageUtils';
import { EmptyState } from '../StatisticsShared/StatisticsShared';

interface IFlashcardFailureListProps {
  failures: StatisticsFlashcardFailure[];
  onHideFailure?: (request: HideStatisticsFailureRequest) => Promise<void>;
  footer?: React.ReactNode;
}

export const FlashcardFailureList = ({
  failures,
  onHideFailure,
  footer,
}: IFlashcardFailureListProps) => {
  const [pendingHideKey, setPendingHideKey] = useState<string | null>(null);

  const handleHideFailure = useCallback(
    async (failure: StatisticsFlashcardFailure) => {
      if (!onHideFailure) return;
      const confirmed = window.confirm(
        'Remove this failed flashcard from Statistics?',
      );
      if (!confirmed) return;

      setPendingHideKey(failure.groupKey);
      try {
        await onHideFailure({
          kind: 'flashcard',
          groupKey: failure.groupKey,
          flashcardSetId: failure.flashcardSetId,
          flashcardId: failure.cardId,
        });
      } finally {
        setPendingHideKey(null);
      }
    },
    [onHideFailure],
  );

  const renderFailure = useCallback(
    (failure: StatisticsFlashcardFailure) => (
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Flashcard</Badge>
                {failure.flashcardSetTitle && (
                  <span className="text-xs font-medium text-foreground">
                    {failure.flashcardSetTitle}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(failure.occurredAt)}
                </span>
                {failure.repeatedFailureCount > 1 && (
                  <Badge variant="outline">{failure.repeatedFailureCount} repeats</Badge>
                )}
              </div>
              <h3 className="text-sm font-semibold text-foreground">{failure.cardFront}</h3>
              {failure.cardBack && (
                <p className="mt-2 text-sm text-muted-foreground">{failure.cardBack}</p>
              )}
              {failure.cardExplanation && (
                <div className="mt-2 rounded-md border border-border bg-muted/10 p-3 text-sm">
                  <p className="text-xs uppercase text-muted-foreground">Explanation</p>
                  <p className="mt-1 text-foreground">{failure.cardExplanation}</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 md:w-48">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/flashcard-set/${failure.flashcardSetId}`}>Open set</Link>
              </Button>
              {failure.sourceDocuments.slice(0, 1).map((document) => (
                <Button key={document.id} variant="ghost" size="sm" asChild>
                  <Link to={`/document/${document.id}`}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Source
                  </Link>
                </Button>
              ))}
              {onHideFailure && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleHideFailure(failure)}
                  disabled={pendingHideKey === failure.groupKey}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    ),
    [handleHideFailure, onHideFailure, pendingHideKey],
  );

  if (failures.length === 0) {
    return (
      <EmptyState
        title="No failed flashcards in this range"
        description="Cards you mark as failed will appear here after you leave or finish a turn."
      />
    );
  }

  return (
    <>
      <VirtualizedList
        items={failures}
        scrollMode="window"
        estimateSize={200}
        gap={12}
        renderItem={renderFailure}
      />
      {footer}
    </>
  );
};
