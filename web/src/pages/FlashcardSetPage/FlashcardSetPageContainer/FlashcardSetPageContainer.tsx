import React from 'react';
import { Page } from '../../../components/Page';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useFlashcardSetPageContext } from '../context/hooks/useFlashcardSetPageContext';
import { ArrowLeft, ArrowRight, Home, RefreshCw } from 'lucide-react';
import { cn } from '../../../lib/utils';
import '../Flashcard.css';

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

  return (
    <Page showSidebar={true}>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">{flashcardSet.title}</h1>
          <Button variant="ghost" onClick={handleGoBack}>
            <Home className="mr-2 h-4 w-4" /> Back to All Sets
          </Button>
        </div>

        <div className="flex flex-col items-center">
          <div className="flashcard-container w-full max-w-xl h-80" onClick={handleFlip}>
            <div className={cn('flashcard', { 'is-flipped': isFlipped })}>
              <div className="flashcard-face flashcard-front">
                <div className="flex items-center justify-center h-full text-2xl font-semibold p-6 text-center">
                  {currentCard?.front}
                </div>
              </div>
              <div className="flashcard-face flashcard-back">
                <div className="flex items-center justify-center h-full text-lg p-6 text-center">
                  {currentCard?.back}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-muted-foreground">
            <p>Card {currentIndex + 1} of {totalCards}</p>
          </div>

          <div className="mt-4 flex items-center justify-center gap-4 w-full max-w-xl">
            <Button variant="outline" onClick={handlePrev} disabled={currentIndex === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Previous
            </Button>
            <Button variant="outline" onClick={() => handleNext(totalCards)} disabled={currentIndex === totalCards - 1}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {currentIndex === totalCards - 1 && (
            <div className="mt-8 text-center">
              <p className="text-lg font-semibold mb-4">You've reached the end of the set!</p>
              <Button onClick={handleRestart}>
                <RefreshCw className="mr-2 h-4 w-4" /> Restart
              </Button>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
};
