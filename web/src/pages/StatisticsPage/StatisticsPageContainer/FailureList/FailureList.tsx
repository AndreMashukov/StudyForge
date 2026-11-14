import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  MoreHorizontal,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  HideStatisticsFailureRequest,
  StatisticsRecentFailure,
} from '@shared-types';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Input } from '../../../../components/ui/Input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../../../../components/ui/DropdownMenu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/Select';
import { useAppDispatch, useAppSelector } from '../../../../hooks/redux';
import {
  selectStatisticsFailure,
  setStatisticsSearch,
  setStatisticsSort,
} from '../../../../store/slices/statisticsPageSlice';
import { cn } from '../../../../lib/utils';
import {
  detailQuizPath,
  formatDateTime,
  quizTypeLabel,
} from '../../utils/statisticsPageUtils';
import { EmptyState } from '../StatisticsShared/StatisticsShared';
import { FailureAnswerComparison } from './FailureAnswerComparison';

interface IFailureListProps {
  failures: StatisticsRecentFailure[];
  hasMore?: boolean;
  onHideFailure?: (request: HideStatisticsFailureRequest) => Promise<void>;
  footer?: ReactNode;
}

export const FailureList = ({
  failures,
  hasMore = false,
  onHideFailure,
  footer,
}: IFailureListProps) => {
  const dispatch = useAppDispatch();
  const { search, sort, selectedFailureKey } = useAppSelector(
    (state) => state.statisticsPage,
  );
  const [pendingHideKey, setPendingHideKey] = useState<string | null>(null);
  const [hideError, setHideError] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const panelId = useId();
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return failures
      .filter((failure) =>
        `${failure.questionText} ${failure.quizTitle ?? ''} ${failure.sourceDocuments.map((document) => document.title).join(' ')}`
          .toLocaleLowerCase()
          .includes(query),
      )
      .sort(
        (left, right) =>
          (sort === 'repeats'
            ? right.repeatedFailureCount - left.repeatedFailureCount
            : 0) ||
          new Date(right.occurredAt).getTime() -
            new Date(left.occurredAt).getTime(),
      );
  }, [failures, search, sort]);
  const selectedIndex = Math.max(
    0,
    filtered.findIndex((failure) => failure.groupKey === selectedFailureKey),
  );
  const selected = filtered[selectedIndex];
  const select = (index: number, focus = false) => {
    const failure = filtered[index];
    if (!failure) return;
    dispatch(selectStatisticsFailure(failure.groupKey));
    const button = buttons.current.get(failure.groupKey);
    if (focus) button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const offsets: Record<string, number> = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
    };
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      select(event.key === 'Home' ? 0 : filtered.length - 1, true);
    } else if (offsets[event.key]) {
      event.preventDefault();
      select(index + offsets[event.key], true);
    }
  };
  const handleHide = async (failure: StatisticsRecentFailure) => {
    if (
      !onHideFailure ||
      !window.confirm(
        'Remove this question from Progress? The question will be excluded from displayed accuracy and fail counts. Your underlying attempt history is kept.',
      )
    )
      return;
    setPendingHideKey(failure.groupKey);
    setHideError(null);
    try {
      await onHideFailure({
        kind: 'quiz',
        groupKey: failure.groupKey,
        quizType: failure.quizType,
        quizId: failure.quizId,
        questionIndex: failure.questionIndex,
      });
    } catch {
      setHideError('Could not remove this question. Please try again.');
    } finally {
      setPendingHideKey(null);
    }
  };
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Questions to revisit</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Latest miss shown. Repeated misses are grouped by question.
          </p>
        </div>
        <div className="flex min-w-0 gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="pl-9 sm:w-64"
              type="search"
              aria-label="Search questions or quizzes"
              placeholder="Search questions or quizzes"
              value={search}
              onChange={(event) =>
                dispatch(setStatisticsSearch(event.target.value))
              }
            />
          </div>
          <Select
            value={sort}
            onValueChange={(value) => {
              if (value === 'recent' || value === 'repeats')
                dispatch(setStatisticsSort(value));
            }}
          >
            <SelectTrigger
              className="w-36 shrink-0"
              aria-label="Sort questions"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Latest miss</SelectItem>
              <SelectItem value="repeats">Most repeated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {hideError && (
        <p role="alert" className="text-sm text-destructive">
          {hideError}
        </p>
      )}
      {!selected ? (
        <EmptyState
          title={
            search
              ? 'No questions match your search'
              : 'No missed questions in this history'
          }
          description={
            hasMore
              ? 'Load more history to find earlier questions.'
              : 'Try another filter or continue practising a quiz.'
          }
        />
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <nav
            aria-label="Questions to revisit"
            className="flex max-w-full self-start gap-px overflow-x-auto rounded-xl border bg-border lg:max-h-[70vh] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden"
          >
            {filtered.map((failure, index) => (
              <button
                key={failure.groupKey}
                type="button"
                ref={(element) => {
                  if (element) buttons.current.set(failure.groupKey, element);
                  else buttons.current.delete(failure.groupKey);
                }}
                onClick={() => select(index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                aria-pressed={index === selectedIndex}
                aria-controls={panelId}
                tabIndex={index === selectedIndex ? 0 : -1}
                className={cn(
                  'w-64 shrink-0 border-l-2 border-transparent bg-card p-4 text-left transition-colors hover:bg-muted lg:w-full',
                  index === selectedIndex && 'border-primary bg-primary/10',
                )}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {quizTypeLabel(failure.quizType)}
                  </Badge>
                  {failure.repeatedFailureCount > 1 && (
                    <span className="text-xs text-muted-foreground">
                      {failure.repeatedFailureCount} misses
                    </span>
                  )}
                </span>
                <span className="my-2 line-clamp-2 block text-sm leading-relaxed">
                  {failure.questionText}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(failure.occurredAt)}
                </span>
              </button>
            ))}
          </nav>
          <section
            id={panelId}
            aria-label="Selected question"
            className="min-w-0 self-start lg:sticky lg:top-28"
          >
            <Card key={selected.groupKey}>
              <CardContent className="min-w-0 p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">
                    {quizTypeLabel(selected.quizType)}
                  </Badge>
                  <span className="min-w-0 break-words">
                    {selected.quizTitle}
                  </span>
                  <span>{formatDateTime(selected.occurredAt)}</span>
                  {selected.repeatedFailureCount > 1 && (
                    <span>Missed {selected.repeatedFailureCount} times</span>
                  )}
                </div>
                <h3 className="my-4 break-words text-base font-semibold leading-relaxed">
                  {selected.questionText}
                </h3>
                <FailureAnswerComparison failure={selected} />
                {(selected.hint || selected.explanation) && (
                  <details className="mt-4 text-sm leading-relaxed">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      Hint & explanation
                    </summary>
                    {selected.hint && (
                      <p className="mt-3 whitespace-pre-wrap break-words">
                        <span className="font-medium">Hint · </span>
                        {selected.hint}
                      </p>
                    )}
                    {selected.explanation && (
                      <p className="mt-3 whitespace-pre-wrap break-words">
                        <span className="font-medium">Explanation · </span>
                        {selected.explanation}
                      </p>
                    )}
                  </details>
                )}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div className="flex min-w-0 max-w-full flex-wrap gap-1">
                    {selected.sourceDocuments.map((document) => (
                      <Button
                        key={document.id}
                        size="sm"
                        variant="ghost"
                        asChild
                      >
                        <Link
                          to={`/document/${document.id}`}
                          title={document.title}
                          className="max-w-full"
                        >
                          <BookOpen
                            className="mr-2 h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          <span className="truncate">
                            {selected.sourceDocuments.length === 1
                              ? 'Source document'
                              : document.title}
                          </span>
                        </Link>
                      </Button>
                    ))}
                    <Button size="sm" variant="ghost" asChild>
                      <Link
                        to={detailQuizPath(selected.quizType, selected.quizId)}
                      >
                        Quiz detail
                      </Link>
                    </Button>
                  </div>
                  {onHideFailure && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Question actions"
                          disabled={pendingHideKey !== null}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => void handleHide(selected)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove from Progress
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardContent>
            </Card>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => select(selectedIndex - 1)}
                disabled={selectedIndex === 0}
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Previous
              </Button>
              <span role="status" className="text-xs text-muted-foreground">
                Question {selectedIndex + 1} of {filtered.length}
                {hasMore ? ' loaded' : ''}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => select(selectedIndex + 1)}
                disabled={selectedIndex === filtered.length - 1}
              >
                Next
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </section>
        </div>
      )}
      {footer}
      {hasMore && (
        <p className="text-xs text-muted-foreground">
          Search and sort apply to loaded questions. Load more to include
          earlier history.
        </p>
      )}
    </div>
  );
};
