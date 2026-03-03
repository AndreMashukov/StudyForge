import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Page } from '../../components/Page';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useGetFlashcardSetQuery } from '../../store/api/Flashcards/FlashcardsApi';
import { ArrowLeft, ArrowRight, Home, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import './Flashcard.css';

export const FlashcardSetPage = () => {
  const { flashcardSetId } = useParams<{ flashcardSetId: string }>();
  const navigate = useNavigate();
  const { data: flashcardSetResponse, error, isLoading } = useGetFlashcardSetQuery({ flashcardSetId: flashcardSetId! });
  const flashcardSet = flashcardSetResponse?.success ? flashcardSetResponse.data : undefined;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const currentCard = useMemo(() => {
    return flashcardSet?.flashcards?.[currentIndex];
  }, [flashcardSet, currentIndex]);

  const handleNext = () => {
    setIsFlipped(false); // Reset flip state on navigation
    setCurrentIndex((prev) => Math.min(prev + 1, (flashcardSet?.flashcards?.length ?? 1) - 1));
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };
  
  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };
  
  const handleRestart = () => {
    setIsFlipped(false);
    setCurrentIndex(0);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
          <span className="ml-3 text-muted-foreground">Loading flashcard set...</span>
        </div>
      );
    }

    if (error || !flashcardSet?.flashcards) {
      return (
        <Card className="m-4 border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive mb-4">Error loading flashcard set.</p>
            <Button variant="outline" onClick={() => navigate('/flashcards')}>Back to List</Button>
          </CardContent>
        </Card>
      );
    }

    if (flashcardSet.flashcards.length === 0) {
      return (
        <Card className="m-4">
          <CardContent className="p-6 text-center text-muted-foreground">
            <p className="mb-4">This flashcard set is empty.</p>
            <Button variant="outline" onClick={() => navigate('/flashcards')}>Back to List</Button>
          </CardContent>
        </Card>
      );
    }

    const totalCards = flashcardSet.flashcards.length;

    return (
      <div className="flex flex-col items-center">
        {/* Flashcard */}
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

        {/* Progress and Controls */}
        <div className="mt-6 text-center text-muted-foreground">
          <p>Card {currentIndex + 1} of {totalCards}</p>
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 w-full max-w-xl">
          <Button variant="outline" onClick={handlePrev} disabled={currentIndex === 0}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Previous
          </Button>
          <Button variant="outline" onClick={handleNext} disabled={currentIndex === totalCards - 1}>
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
    );
  };

  return (
    <Page showSidebar={true}>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">{flashcardSet?.title || 'Loading...'}</h1>
            <Button variant="ghost" onClick={() => navigate('/flashcards')}>
                <Home className="mr-2 h-4 w-4" /> Back to All Sets
            </Button>
        </div>
        {renderContent()}
      </div>
    </Page>
  );
};
