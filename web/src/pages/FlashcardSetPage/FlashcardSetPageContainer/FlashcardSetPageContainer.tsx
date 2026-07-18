import React from 'react';
import { Page } from '../../../components/Page';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useFlashcardSetPageContext } from '../context/hooks/useFlashcardSetPageContext';
import {
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  ChevronLeft,
  Maximize2,
  Minimize2,
  Check,
  X,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Spinner } from '../../../components/ui/Spinner';
import { FlashcardHtmlContent } from './FlashcardHtmlContent';
import { resolveFlashcardHtml } from './flashcardHtmlUtils';

export const FlashcardSetPageContainer = () => {
  const { api, handlers } = useFlashcardSetPageContext();
  const { flashcardSet, isLoading, error } = api;
  const {
    currentIndex,
    isFlipped,
    isFullscreen,
    activeQueue,
    learnedCount,
    failedCount,
    retakeCount,
    isSessionComplete,
    canStartRetake,
    canAdvanceNext,
    handleNext,
    handlePrev,
    handleFlip,
    handleMarkLearned,
    handleMarkFailed,
    handleStartRetake,
    handleRestart,
    handleGoBack,
    handleToggleFullscreen,
  } = handlers;

  if (isLoading) {
    return (
      <Page showSidebar={true}>
        <div className="flex items-center justify-center p-8">
          <Spinner size="md" />
          <span className="ml-3 text-muted-foreground">
            Loading flashcard set...
          </span>
        </div>
      </Page>
    );
  }

  if (error || !flashcardSet?.flashcards) {
    return (
      <Page showSidebar={true}>
        <Card className="m-4 border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive mb-4">
              Error loading flashcard set.
            </p>
            <Button variant="outline" onClick={handleGoBack}>
              Back to List
            </Button>
          </CardContent>
        </Card>
      </Page>
    );
  }

  if (flashcardSet.flashcards.length === 0) {
    return (
      <Page showSidebar={true}>
        <Card className="m-4">
          <CardContent className="p-6 text-center text-muted-foreground">
            <p className="mb-4">This flashcard set is empty.</p>
            <Button variant="outline" onClick={handleGoBack}>
              Back to List
            </Button>
          </CardContent>
        </Card>
      </Page>
    );
  }

  const cardById = new Map(flashcardSet.flashcards.map((card) => [card.id, card]));
  const queueLength = activeQueue.length;
  const safeIndex = Math.min(currentIndex, Math.max(queueLength - 1, 0));
  const currentCardId = activeQueue[safeIndex];
  const currentCard = currentCardId ? cardById.get(currentCardId) : undefined;
  const reviewedCount = isSessionComplete ? queueLength : safeIndex + 1;
  const progressPct =
    queueLength === 0 ? 0 : Math.round((reviewedCount / queueLength) * 100);
  const positionLabel = isSessionComplete
    ? `${queueLength} / ${queueLength}`
    : `${safeIndex + 1} / ${queueLength}`;

  const frontHtml = resolveFlashcardHtml(currentCard?.frontHtml, currentCard?.front);
  const backHtml = resolveFlashcardHtml(currentCard?.backHtml, currentCard?.back);
  const descriptionHtml = resolveFlashcardHtml(
    currentCard?.descriptionHtml,
    currentCard?.description
  );
  const hasDescription = !!descriptionHtml;

  const studyControls = (
    <div className="max-w-2xl mx-auto flex items-center justify-center gap-3 sm:gap-4">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={(event) => {
          event.stopPropagation();
          handlePrev();
        }}
        disabled={currentIndex === 0 || isSessionComplete}
        aria-label="Previous card"
        className="h-12 w-12 rounded-full active:scale-95"
      >
        <ArrowLeft className="h-5 w-5 text-primary" />
      </Button>

      <Button
        type="button"
        variant="destructive"
        onClick={(event) => {
          event.stopPropagation();
          handleMarkFailed();
        }}
        disabled={isSessionComplete || !currentCard}
        aria-label="Mark card as failed"
        className="h-12 min-w-[4.5rem] gap-2 rounded-full px-4 active:scale-95"
      >
        <X className="h-5 w-5" />
        <span className="text-sm font-semibold tabular-nums">{failedCount}</span>
      </Button>

      <Button
        type="button"
        variant="default"
        onClick={(event) => {
          event.stopPropagation();
          handleMarkLearned();
        }}
        disabled={isSessionComplete || !currentCard}
        aria-label="Mark card as learned"
        className="h-12 min-w-[4.5rem] gap-2 rounded-full px-4 active:scale-95"
      >
        <span className="text-sm font-semibold tabular-nums">{learnedCount}</span>
        <Check className="h-5 w-5" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={(event) => {
          event.stopPropagation();
          handleNext();
        }}
        disabled={!canAdvanceNext}
        aria-label="Next card"
        className="h-12 w-12 rounded-full active:scale-95"
      >
        <ArrowRight className="h-5 w-5 text-primary" />
      </Button>
    </div>
  );

  const endOfTurnActions = isSessionComplete ? (
    <div className="mt-5 text-center space-y-3">
      <p className="text-sm font-semibold text-muted-foreground">
        {canStartRetake
          ? `Turn complete — ${retakeCount} card${retakeCount === 1 ? '' : 's'} to retake.`
          : 'All cards in this turn are learned.'}
      </p>
      <div className="flex items-center justify-center gap-2">
        {canStartRetake ? (
          <Button onClick={handleStartRetake}>Retake failed cards</Button>
        ) : null}
        <Button variant="outline" onClick={handleRestart}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Restart set
        </Button>
      </div>
    </div>
  ) : null;

  const cardArea = currentCard ? (
    <div
      className="w-full max-w-xl cursor-pointer hover:[filter:drop-shadow(0_0_14px_color-mix(in_srgb,var(--primary)_20%,transparent))] transition-[filter] duration-300"
      style={{ perspective: '1200px', height: 'clamp(240px, 40vh, 380px)' }}
      onClick={handleFlip}
    >
      <div
        className={cn(
          'relative w-full h-full [transform-style:preserve-3d] transition-transform duration-[650ms] ease-[cubic-bezier(0.4,0.2,0.2,1)]',
          isFlipped && '[transform:rotateY(180deg)]'
        )}
      >
        <div className="absolute inset-0 flex flex-col [backface-visibility:hidden] [-webkit-backface-visibility:hidden] rounded-[var(--radius,0.5rem)] border border-border bg-card text-card-foreground shadow-[0_4px_6px_-1px_rgba(0,0,0,0.25),0_10px_40px_-10px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between px-4 pt-3">
            <p className="text-xs text-muted-foreground tabular-nums">{positionLabel}</p>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center px-6 sm:px-8 text-center">
            <FlashcardHtmlContent
              html={frontHtml}
              className="text-lg sm:text-2xl font-bold leading-snug text-center"
            />
          </div>
          <p className="pb-4 text-center text-xs text-muted-foreground">
            {isFlipped ? '' : 'See answer'}
          </p>
        </div>

        <div className="absolute inset-0 flex flex-col [backface-visibility:hidden] [-webkit-backface-visibility:hidden] [transform:rotateY(180deg)] rounded-[var(--radius,0.5rem)] border border-border bg-card text-card-foreground shadow-[0_4px_6px_-1px_rgba(0,0,0,0.25),0_10px_40px_-10px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between px-4 pt-3">
            <p className="text-xs text-muted-foreground tabular-nums">{positionLabel}</p>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 sm:px-8 text-center overflow-y-auto py-4">
            <FlashcardHtmlContent
              html={backHtml}
              className="text-base sm:text-xl font-semibold leading-relaxed text-center"
            />
            {currentCard.explanation ? (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
                {currentCard.explanation}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="w-full max-w-xl rounded-[var(--radius,0.5rem)] border border-border bg-card p-8 text-center text-muted-foreground">
      No cards remaining in this turn.
    </div>
  );

  if (isFullscreen) {
    return (
      <Page showSidebar={true}>
        <div className="fixed inset-0 z-[2000] bg-background flex flex-col">
          <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-border bg-background shrink-0">
            <div className="max-w-3xl mx-auto flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold leading-tight truncate">
                  {flashcardSet.title}
                </h1>
                {flashcardSet.documentTitle ? (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {flashcardSet.documentTitle}
                  </p>
                ) : null}
              </div>
              <div className="flex items-start gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                    {positionLabel}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{progressPct}%</p>
                </div>
                <button
                  onClick={handleToggleFullscreen}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Exit fullscreen"
                >
                  <Minimize2 size={16} />
                </button>
              </div>
            </div>
            <div className="mt-2 max-w-3xl mx-auto h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center px-4 sm:px-6 py-5 sm:py-6 overflow-y-auto">
            <div className="flex flex-col items-center justify-center w-full flex-1">
              {cardArea}
              {endOfTurnActions}
            </div>
            {hasDescription && isFlipped && currentCard ? (
              <div className="w-full max-w-2xl mx-auto mt-4 rounded-xl border border-border bg-muted/40 px-4 py-3">
                <FlashcardHtmlContent html={descriptionHtml} />
              </div>
            ) : null}
          </div>

          <div className="border-t border-border bg-background px-4 sm:px-6 py-4 shrink-0">
            {studyControls}
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page showSidebar={true}>
      <div className="flex flex-col">
        <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-border bg-background">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-start justify-between mb-1 gap-2">
              <div className="min-w-0">
                <button
                  onClick={handleGoBack}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back to directory
                </button>
                <h1 className="text-base sm:text-lg font-bold leading-tight truncate">
                  {flashcardSet.title}
                </h1>
                {flashcardSet.documentTitle ? (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {flashcardSet.documentTitle}
                  </p>
                ) : null}
              </div>

              <div className="flex items-start gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                    {positionLabel}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{progressPct}%</p>
                </div>
                <button
                  onClick={handleToggleFullscreen}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Enter fullscreen"
                >
                  <Maximize2 size={16} />
                </button>
              </div>
            </div>

            <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center px-4 sm:px-6 py-5 sm:py-6">
          {cardArea}
          {endOfTurnActions}
        </div>

        <div className="border-t border-border bg-background px-4 sm:px-6 py-4">
          {studyControls}
        </div>

        {hasDescription && isFlipped && currentCard ? (
          <div className="px-4 sm:px-6 pb-5">
            <div className="max-w-2xl mx-auto rounded-xl border border-border bg-muted/40 px-4 py-3">
              <FlashcardHtmlContent html={descriptionHtml} />
            </div>
          </div>
        ) : null}
      </div>
    </Page>
  );
};
