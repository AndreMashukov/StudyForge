import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Page } from '../../components/Page';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useGetSlideDeckQuery } from '../../store/api/SlideDecks/SlideDecksApi';
import { ArrowLeft, ChevronLeft, ChevronRight, Presentation } from 'lucide-react';

export const SlideDeckPage = () => {
  const { slideDeckId } = useParams<{ slideDeckId: string }>();
  const navigate = useNavigate();
  const { data: response, isLoading } = useGetSlideDeckQuery(
    { slideDeckId: slideDeckId || '' },
    { skip: !slideDeckId }
  );
  const [currentSlide, setCurrentSlide] = useState(0);

  const slideDeck = response?.data;
  const slides = slideDeck?.slides || [];
  const slide = slides[currentSlide];

  if (isLoading) {
    return (
      <Page showSidebar={false}>
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </Page>
    );
  }

  if (!slideDeck) {
    return (
      <Page showSidebar={false}>
        <Card className="m-4 border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive">Slide deck not found.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/slides')}>
              Back to Slide Decks
            </Button>
          </CardContent>
        </Card>
      </Page>
    );
  }

  return (
    <Page showSidebar={false}>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="sticky top-0 bg-background border-b px-6 py-3 z-10">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <button
              onClick={() => navigate('/slides')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={20} />
              Back to Slide Decks
            </button>
            <div className="flex items-center gap-2">
              <Presentation size={20} />
              <h1 className="text-lg font-semibold">{slideDeck.title}</h1>
            </div>
            <div className="text-sm text-muted-foreground">
              Slide {currentSlide + 1} of {slides.length}
            </div>
          </div>
        </header>

        {/* Slide viewer */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-4xl">
            {slide && (
              <Card className="aspect-[16/9] flex flex-col justify-center p-8 md:p-12 bg-card border-2">
                <CardContent className="p-0 space-y-6">
                  <h2 className="text-2xl md:text-4xl font-bold text-primary">
                    {slide.title}
                  </h2>
                  <div className="text-base md:text-lg text-foreground whitespace-pre-line leading-relaxed">
                    {slide.content}
                  </div>
                  {slide.speakerNotes && (
                    <div className="mt-auto pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground italic">
                        Speaker notes: {slide.speakerNotes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Navigation controls */}
        <div className="border-t px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
              disabled={currentSlide === 0}
            >
              <ChevronLeft size={20} className="mr-1" />
              Previous
            </Button>

            <div className="flex gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    i === currentSlide ? 'bg-primary' : 'bg-muted hover:bg-muted-foreground/30'
                  }`}
                />
              ))}
            </div>

            <Button
              variant="outline"
              onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
              disabled={currentSlide === slides.length - 1}
            >
              Next
              <ChevronRight size={20} className="ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </Page>
  );
};
