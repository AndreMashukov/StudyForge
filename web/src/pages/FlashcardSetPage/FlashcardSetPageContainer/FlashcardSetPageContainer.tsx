import React from 'react';
import { Page } from '../../../components/Page';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useFlashcardSetPageContext } from '../context/hooks/useFlashcardSetPageContext';
import { ArrowLeft, ArrowRight, RotateCcw, ChevronLeft } from 'lucide-react';
import { cn } from '../../../lib/utils';

export const FlashcardSetPageContainer = () => {
  const { api, handlers } = useFlashcardSetPageContext();
  const { flashcardSet, isLoading, error } = api;
  const { currentIndex, isFlipped, handleNext, handlePrev, handleFlip, handleRestart, handleGoBack } = handlers;

  if (isLoading) {
    return (
      <Page showSidebar={true}>
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
          <span className="ml-3 text-muted-foreground">Loading flashcard set...</span>
        </div>
      </Page>
    );
  }

  if (error || !flashcardSet?.flashcards) {
    return (
      <Page showSidebar={true}>
        <Card className="m-4 border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive mb-4">Error loading flashcard set.</p>
            <Button variant="outline" onClick={handleGoBack}>Back to List</Button>
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
            <Button variant="outline" onClick={handleGoBack}>Back to List</Button>
          </CardContent>
        </Card>
      </Page>
    );
  }

  const totalCards = flashcardSet.flashcards.length;
  const currentCard = flashcardSet.flashcards[currentIndex];
  const progressPct = Math.round(((currentIndex + 1) / totalCards) * 100);
  const isLast = currentIndex === totalCards - 1;

  return (
    <Page showSidebar={true}>
      <div className="flex flex-col h-full min-h-[calc(100vh-4rem)]">

        {/* ── Top header ─────────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-3 border-b border-border bg-background">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-1">
              <div>
                <button
                  onClick={handleGoBack}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  All Sets
                </button>
                <h1 className="text-lg font-bold leading-tight">{flashcardSet.title}</h1>
                {flashcardSet.documentTitle && (
                  <p className="text-xs text-muted-foreground mt-0.5">{flashcardSet.documentTitle}</p>
                )}
              </div>

              <div className="text-right shrink-0 ml-4">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Card {currentIndex + 1} of {totalCards}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{progressPct}% Complete</p>
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
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
          {/* Perspective wrapper — hover glow lives here so it never touches the preserve-3d element */}
          <div
            className="w-full max-w-2xl cursor-pointer hover:[filter:drop-shadow(0_0_14px_rgba(99,102,241,0.2))] transition-[filter] duration-300"
            style={{ perspective: '1200px', height: 'clamp(280px, 40vh, 420px)' }}
            onClick={handleFlip}
          >
            {/* Flip element — preserve-3d must not have filter/overflow applied to it */}
            <div
              className={cn(
                'relative w-full h-full [transform-style:preserve-3d] transition-transform duration-[650ms] ease-[cubic-bezier(0.4,0.2,0.2,1)]',
                isFlipped && '[transform:rotateY(180deg)]'
              )}
            >
              {/* FRONT */}
              <div className="absolute inset-0 flex flex-col items-center justify-center [backface-visibility:hidden] [-webkit-backface-visibility:hidden] rounded-[var(--radius,0.5rem)] border border-border bg-card text-card-foreground shadow-[0_4px_6px_-1px_rgba(0,0,0,0.25),0_10px_40px_-10px_rgba(0,0,0,0.3)]">
                <div className="px-8 text-center">
                  <p className="text-xl sm:text-2xl font-bold leading-snug">
                    {currentCard?.front}
                  </p>
                </div>
              </div>

              {/* BACK */}
              <div className="absolute inset-0 flex flex-col items-center justify-center [backface-visibility:hidden] [-webkit-backface-visibility:hidden] [transform:rotateY(180deg)] rounded-[var(--radius,0.5rem)] border border-border bg-card text-card-foreground shadow-[0_4px_6px_-1px_rgba(0,0,0,0.25),0_10px_40px_-10px_rgba(0,0,0,0.3)]">
                <div className="flex flex-col items-center gap-3 px-8 text-center">
                  <p className="text-lg sm:text-xl font-semibold leading-relaxed">
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

          {/* End-of-set message */}
          {isLast && (
            <div className="mt-6 text-center">
              <p className="text-sm font-semibold text-muted-foreground mb-3">
                🎉 You've reached the end of the set!
              </p>
            </div>
          )}
        </div>

        {/* ── Bottom navigation ──────────────────────────────────── */}
        <div className="border-t border-border bg-background px-6 py-4">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            {/* Previous */}
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border text-sm font-semibold transition-all',
                currentIndex === 0
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-muted active:scale-95'
              )}
            >
              <ArrowLeft className="h-4 w-4" /> Previous
            </button>

            {/* Restart — on last card */}
            {isLast ? (
              <button
                onClick={handleRestart}
                className="flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-muted border border-border text-sm font-semibold hover:bg-muted/80 active:scale-95 transition-all"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            ) : null}

            {/* Next */}
            <button
              onClick={() => handleNext(totalCards)}
              disabled={isLast}
              className={cn(
                'flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all',
                isLast
                  ? 'bg-primary/40 text-primary-foreground cursor-not-allowed opacity-60'
                  : 'bg-primary text-primary-foreground hover:opacity-90 active:scale-95'
              )}
            >
              {isLast ? 'Completed' : <>Next Card <ArrowRight className="h-4 w-4" /></>}
            </button>
          </div>
        </div>

      </div>
    </Page>
  );
};
