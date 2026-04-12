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
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Spinner } from '../../../components/ui/Spinner';

export const FlashcardSetPageContainer = () => {
  const { api, handlers } = useFlashcardSetPageContext();
  const { flashcardSet, isLoading, error } = api;
  const {
    currentIndex,
    isFlipped,
    isFullscreen,
    handleNext,
    handlePrev,
    handleFlip,
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

  const totalCards = flashcardSet.flashcards.length;
  const currentCard = flashcardSet.flashcards[currentIndex];
  const progressPct = Math.round(((currentIndex + 1) / totalCards) * 100);
  const isLast = currentIndex === totalCards - 1;

  // Shared card UI — used in both normal and fullscreen mode
  const cardArea = (
    <div
      className="w-full max-w-xl cursor-pointer hover:[filter:drop-shadow(0_0_14px_rgba(99,102,241,0.2))] transition-[filter] duration-300"
      style={{ perspective: '1200px', height: 'clamp(240px, 40vh, 380px)' }}
      onClick={handleFlip}
    >
      <div
        className={cn(
          'relative w-full h-full [transform-style:preserve-3d] transition-transform duration-[650ms] ease-[cubic-bezier(0.4,0.2,0.2,1)]',
          isFlipped && '[transform:rotateY(180deg)]'
        )}
      >
        {/* FRONT */}
        <div className="absolute inset-0 flex flex-col items-center justify-center [backface-visibility:hidden] [-webkit-backface-visibility:hidden] rounded-[var(--radius,0.5rem)] border border-border bg-card text-card-foreground shadow-[0_4px_6px_-1px_rgba(0,0,0,0.25),0_10px_40px_-10px_rgba(0,0,0,0.3)]">
          <div className="px-6 sm:px-8 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
              Tap to reveal
            </p>
            <p className="text-lg sm:text-2xl font-bold leading-snug">
              {currentCard?.front}
            </p>
          </div>
        </div>

        {/* BACK */}
        <div className="absolute inset-0 flex flex-col items-center justify-center [backface-visibility:hidden] [-webkit-backface-visibility:hidden] [transform:rotateY(180deg)] rounded-[var(--radius,0.5rem)] border border-border bg-card text-card-foreground shadow-[0_4px_6px_-1px_rgba(0,0,0,0.25),0_10px_40px_-10px_rgba(0,0,0,0.3)]">
          <div className="flex flex-col items-center gap-3 px-6 sm:px-8 text-center overflow-y-auto max-h-full py-4">
            <p className="text-base sm:text-xl font-semibold leading-relaxed">
              {currentCard?.back}
            </p>
            {currentCard?.explanation && (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
                {currentCard.explanation}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Fullscreen mode — covers the entire viewport, no app bar or sidebar visible
  if (isFullscreen) {
    return (
      <Page showSidebar={true}>
        <div className="fixed inset-0 z-[2000] bg-background flex flex-col">
          {/* Fullscreen header */}
          <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-border bg-background shrink-0">
            <div className="max-w-3xl mx-auto flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold leading-tight truncate">
                  {flashcardSet.title}
                </h1>
                {flashcardSet.documentTitle && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {flashcardSet.documentTitle}
                  </p>
                )}
              </div>
              <div className="flex items-start gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                    {currentIndex + 1} / {totalCards}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {progressPct}%
                  </p>
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
            {/* Progress bar */}
            <div className="mt-2 max-w-3xl mx-auto h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Card area */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-5 sm:py-6 overflow-hidden">
            {cardArea}
            {isLast && (
              <div className="mt-5 text-center">
                <p className="text-sm font-semibold text-muted-foreground mb-3">
                  You&apos;ve reached the end of the set!
                </p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="border-t border-border bg-background px-4 sm:px-6 py-4 shrink-0">
            <div className="max-w-2xl mx-auto flex items-center gap-2 sm:gap-3">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 rounded-xl border border-border text-sm font-semibold transition-all',
                  currentIndex === 0
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-muted active:scale-95'
                )}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </button>

              {isLast ? (
                <button
                  onClick={handleRestart}
                  aria-label="Restart"
                  className="flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl bg-muted border border-border text-sm font-semibold hover:bg-muted/80 active:scale-95 transition-all"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              ) : null}

              <button
                onClick={() => handleNext(totalCards)}
                disabled={isLast}
                className={cn(
                  'flex-[2] flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 rounded-xl text-sm font-semibold transition-all',
                  isLast
                    ? 'bg-primary/40 text-primary-foreground cursor-not-allowed opacity-60'
                    : 'bg-primary text-primary-foreground hover:opacity-90 active:scale-95'
                )}
              >
                {isLast ? (
                  'Completed'
                ) : (
                  <>
                    Next <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page showSidebar={true}>
      <div className="flex flex-col">
        {/* ── Top header ─────────────────────────────────────────── */}
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
                {flashcardSet.documentTitle && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {flashcardSet.documentTitle}
                  </p>
                )}
              </div>

              <div className="flex items-start gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                    {currentIndex + 1} / {totalCards}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {progressPct}%
                  </p>
                </div>
                <button
                  onClick={handleToggleFullscreen}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label={
                    isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'
                  }
                >
                  {isFullscreen ? (
                    <Minimize2 size={16} />
                  ) : (
                    <Maximize2 size={16} />
                  )}
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Card area ──────────────────────────────────────────── */}
        <div className="flex flex-col items-center justify-center px-4 sm:px-6 py-5 sm:py-6">
          {cardArea}

          {/* End-of-set message */}
          {isLast && (
            <div className="mt-5 text-center">
              <p className="text-sm font-semibold text-muted-foreground mb-3">
                <span role="img" aria-label="Celebration">
                  🎉
                </span>{' '}
                You&apos;ve reached the end of the set!
              </p>
            </div>
          )}
        </div>

        {/* ── Bottom navigation ──────────────────────────────────── */}
        <div className="border-t border-border bg-background px-4 sm:px-6 py-4">
          <div className="max-w-2xl mx-auto flex items-center gap-2 sm:gap-3">
            {/* Previous */}
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 rounded-xl border border-border text-sm font-semibold transition-all',
                currentIndex === 0
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-muted active:scale-95'
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            {/* Restart — on last card */}
            {isLast ? (
              <button
                onClick={handleRestart}
                aria-label="Restart"
                className="flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl bg-muted border border-border text-sm font-semibold hover:bg-muted/80 active:scale-95 transition-all"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            ) : null}

            {/* Next */}
            <button
              onClick={() => handleNext(totalCards)}
              disabled={isLast}
              className={cn(
                'flex-[2] flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 rounded-xl text-sm font-semibold transition-all',
                isLast
                  ? 'bg-primary/40 text-primary-foreground cursor-not-allowed opacity-60'
                  : 'bg-primary text-primary-foreground hover:opacity-90 active:scale-95'
              )}
            >
              {isLast ? (
                'Completed'
              ) : (
                <>
                  Next <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Page>
  );
};
