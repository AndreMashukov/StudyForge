import React from 'react';
import { useSlideDeckPageContext } from '../context/hooks/useSlideDeckPageContext';
import { Page } from '../../../components/Page';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Spinner } from '../../../components/ui/Spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../components/ui/Tooltip';
import { cn } from '../../../lib/utils';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Presentation,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export const SlideDeckPageContainer: React.FC = () => {
  const deckRef = React.useRef<HTMLDivElement | null>(null);
  const { slideDeckApi, handlers } = useSlideDeckPageContext();
  const { slideDeck, isLoading } = slideDeckApi;
  const {
    currentSlide,
    handleNavigateBack,
    handleSlideChange,
    handlePrevSlide,
    handleNextSlide,
  } = handlers;
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isFullscreenSupported, setIsFullscreenSupported] = React.useState(false);
  const [fullscreenError, setFullscreenError] = React.useState<string | null>(null);

  const fullscreenLabel = isFullscreen ? 'Exit fullscreen' : 'View fullscreen';

  const slides = slideDeck?.slides || [];
  const safeIndex =
    slides.length > 0 ? Math.min(currentSlide, slides.length - 1) : 0;
  const slide = slides.length > 0 ? slides[safeIndex] : undefined;

  const handleToggleFullscreen = React.useCallback(async () => {
    const deckElement = deckRef.current;
    if (!deckElement) return;

    setFullscreenError(null);

    try {
      if (document.fullscreenElement === deckElement) {
        await document.exitFullscreen();
        return;
      }

      if (!document.fullscreenEnabled || typeof deckElement.requestFullscreen !== 'function') {
        setFullscreenError('Fullscreen is unavailable in this browser.');
        return;
      }

      await deckElement.requestFullscreen();
    } catch (fullscreenRequestError) {
      setFullscreenError(
        fullscreenRequestError instanceof Error
          ? fullscreenRequestError.message
          : 'Fullscreen is unavailable in this browser.'
      );
    }
  }, []);

  React.useEffect(() => {
    setIsFullscreenSupported(
      document.fullscreenEnabled && typeof document.exitFullscreen === 'function'
    );

    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === deckRef.current);
    };

    const handleFullscreenError = () => {
      setFullscreenError('Fullscreen is unavailable in this browser.');
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('fullscreenerror', handleFullscreenError);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('fullscreenerror', handleFullscreenError);
    };
  }, []);

  if (isLoading) {
    return (
      <Page showSidebar={false}>
        <div className="flex justify-center items-center p-8">
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
            <Button
              variant="outline"
              className="mt-4"
              onClick={handleNavigateBack}
            >
              Back to directory
            </Button>
          </CardContent>
        </Card>
      </Page>
    );
  }

  // Shared slide content — used in both normal and fullscreen mode
  const slideContent = slide && (
    <div className={cn('w-full', isFullscreen ? 'max-w-6xl' : 'max-w-4xl')}>
      {slide.imageUrl ? (
        <Card className={cn('overflow-hidden border-2', isFullscreen && 'border-border/60 bg-card/80')}>
          <img
            src={slide.imageUrl}
            alt={`Slide: ${slide.title}`}
            className={cn(
              'w-full aspect-[16/9] object-contain bg-black',
              isFullscreen && 'max-h-[calc(100vh-9rem)]'
            )}
          />
        </Card>
      ) : (
        <Card className={cn(
          'flex flex-col justify-center p-6 md:p-12 bg-card border-2 aspect-[16/9]',
          isFullscreen && 'max-h-[calc(100vh-9rem)]'
        )}>
          <CardContent className="p-0 space-y-4">
            <h2 className="text-xl sm:text-2xl md:text-4xl font-bold font-heading text-primary">
              {slide.title}
            </h2>
            <div className="text-sm sm:text-base md:text-lg text-foreground whitespace-pre-line leading-relaxed">
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
  );

  // Shared navigation dots / counter
  const navDots = (
    <div className="flex gap-1.5 flex-wrap justify-center max-w-xs overflow-hidden">
      {slides.length <= 30 &&
        slides.map((_, i) => (
          <button
            key={i}
            onClick={() => handleSlideChange(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i === currentSlide
                ? 'bg-primary'
                : 'bg-muted hover:bg-muted-foreground/30'
            }`}
          />
        ))}
      {slides.length > 30 && (
        <span className="text-xs text-muted-foreground">
          {safeIndex + 1} / {slides.length}
        </span>
      )}
    </div>
  );

  return (
    <Page showSidebar={false}>
      <div
        ref={deckRef}
        className={cn(
          'relative bg-background flex flex-col',
          isFullscreen && 'h-screen w-screen overflow-hidden'
        )}
      >
        <header className={cn(
          'bg-background border-b px-4 py-3 z-10',
          isFullscreen ? 'shrink-0' : 'sticky top-0'
        )}>
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
            {isFullscreen ? (
              <div className="flex items-center gap-2 min-w-0">
                <Presentation size={18} className="shrink-0" />
                <h1 className="text-sm sm:text-lg font-semibold truncate">
                  {slideDeck.title}
                </h1>
              </div>
            ) : (
              <button
                onClick={handleNavigateBack}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label="Back to directory"
              >
                <ArrowLeft size={20} />
                <span className="hidden sm:inline text-sm">
                  Back to directory
                </span>
              </button>
            )}

            {!isFullscreen && (
              <div className="flex items-center gap-2 min-w-0">
                <Presentation size={18} className="shrink-0" />
                <h1 className="text-sm sm:text-lg font-semibold truncate">
                  {slideDeck.title}
                </h1>
              </div>
            )}

            <div className="flex items-center gap-2 shrink-0">
              <span className={cn('text-sm text-muted-foreground', !isFullscreen && 'hidden sm:block')}>
                {slides.length > 0
                  ? `${safeIndex + 1} / ${slides.length}`
                  : 'No slides'}
              </span>
              {isFullscreenSupported && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={handleToggleFullscreen}
                        aria-label={fullscreenLabel}
                        title={fullscreenLabel}
                      >
                        {isFullscreen ? (
                          <Minimize2 size={18} />
                        ) : (
                          <Maximize2 size={18} />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">{fullscreenLabel}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </header>

        <div className={cn(
          'flex justify-center px-4',
          isFullscreen
            ? 'flex-1 items-center overflow-hidden py-4'
            : 'py-6'
        )}>
          {slideContent}
        </div>

        <div className={cn('border-t px-4 py-3', isFullscreen && 'shrink-0')}>
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
            <Button
              variant="outline"
              onClick={handlePrevSlide}
              disabled={currentSlide === 0}
              className="px-3 sm:px-4"
            >
              <ChevronLeft size={20} />
              <span className="hidden sm:inline ml-1">Previous</span>
            </Button>

            {navDots}

            <Button
              variant="outline"
              onClick={() => handleNextSlide(Math.max(slides.length - 1, 0))}
              disabled={
                slides.length === 0 || currentSlide >= slides.length - 1
              }
              className="px-3 sm:px-4"
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight size={20} />
            </Button>
          </div>
        </div>

        {fullscreenError && (
          <p
            className="absolute bottom-16 left-1/2 z-10 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-md border border-destructive/40 bg-background px-3 py-1 text-center text-xs text-destructive shadow-sm"
            role="status"
          >
            {fullscreenError}
          </p>
        )}
      </div>
    </Page>
  );
};
