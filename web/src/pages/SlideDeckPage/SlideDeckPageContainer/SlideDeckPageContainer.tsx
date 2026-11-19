import React from 'react';
import type { Slide } from '@shared-types';
import { useSlideDeckPageContext } from '../context/hooks/useSlideDeckPageContext';
import { Page } from '../../../components/Page';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Spinner } from '../../../components/ui/Spinner';
import { cn } from '../../../lib/utils';
import { SlideDeckHeader } from './SlideDeckHeader';
import { SlideStage } from './SlideStage';
import { SlideRail } from './SlideRail';

export const SlideDeckPageContainer: React.FC = () => {
  const { slideDeckApi, handlers, fullscreen, download } = useSlideDeckPageContext();
  const { slideDeck, isLoading } = slideDeckApi;
  const { currentSlide, handleNavigateBack, handleSlideChange, handlePrevSlide, handleNextSlide } =
    handlers;
  const { isFullscreen, handleToggleFullscreen } = fullscreen;

  if (isLoading) {
    return (
      <Page showSidebar={false}>
        <div className="flex items-center justify-center p-8">
          <Spinner size="md" />
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
            <Button variant="outline" className="mt-4" onClick={handleNavigateBack}>
              Back to directory
            </Button>
          </CardContent>
        </Card>
      </Page>
    );
  }

  const slides = slideDeck.slides ?? [];
  const slide: Slide | undefined = slides[currentSlide];

  return (
    <Page showSidebar={false}>
      {/*
        Fullscreen keeps the same layout: app fullscreen hides the app bar, and this wrapper
        covers the viewport. z-40 stays below popovers/tooltips (z-50) and toasts.
      */}
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col bg-background',
          isFullscreen && 'fixed inset-0 z-40'
        )}
      >
        <SlideDeckHeader
          title={slideDeck.title}
          currentIndex={currentSlide}
          total={slides.length}
          isFullscreen={isFullscreen}
          download={download}
          onNavigateBack={handleNavigateBack}
          onToggleFullscreen={handleToggleFullscreen}
        />

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-4',
            isFullscreen ? 'p-3 lg:p-4' : 'px-3 py-3 md:px-0 lg:py-4'
          )}
        >
          <SlideStage
            slide={slide}
            slideNumber={currentSlide + 1}
            total={slides.length}
            onPrev={handlePrevSlide}
            onNext={handleNextSlide}
          />
          {slides.length > 0 && (
            <SlideRail slides={slides} currentIndex={currentSlide} onSelect={handleSlideChange} />
          )}
        </div>
      </div>
    </Page>
  );
};
