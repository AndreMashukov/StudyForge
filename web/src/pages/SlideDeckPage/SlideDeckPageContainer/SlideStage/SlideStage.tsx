import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { cn } from '../../../../lib/utils';
import { ISlideStage } from './ISlideStage';
import { useSlideSwipe } from './useSlideSwipe';

const overlayButtonClassName = cn(
  'absolute top-1/2 h-10 w-10 -translate-y-1/2 bg-background/80 shadow-md backdrop-blur-sm',
  'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
  '[@media(hover:none)]:opacity-100'
);

export const SlideStage: React.FC<ISlideStage> = ({
  slide,
  slideNumber,
  total,
  onPrev,
  onNext,
  className,
}) => {
  const swipeHandlers = useSlideSwipe({ onPrev, onNext });
  const isFirst = slideNumber <= 1;
  const isLast = slideNumber >= total;
  // Fall back to the text card when the image is missing from Storage.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageUrl = slide?.imageUrl && slide.imageUrl !== failedSrc ? slide.imageUrl : null;

  return (
    // Size container: the 16:9 frame below fits whichever of width/height is tighter.
    // Below lg the stage takes its natural 16:9 height so the thumbnail strip sits right under it.
    <div
      className={cn(
        'relative flex aspect-video w-full min-w-0 flex-none items-center justify-center [container-type:size]',
        'lg:aspect-auto lg:min-h-[12rem] lg:w-auto lg:flex-1',
        className
      )}
    >
      {slide ? (
        <div
          className={cn(
            'group relative aspect-video w-[min(100cqw,calc(100cqh*16/9))] touch-pan-y select-none overflow-hidden rounded-lg border border-border shadow-sm',
            imageUrl ? 'bg-black' : 'bg-card'
          )}
          {...swipeHandlers}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Slide ${slideNumber}: ${slide.title}`}
              draggable={false}
              onError={() => setFailedSrc(imageUrl)}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full flex-col justify-center gap-4 overflow-y-auto p-6 md:p-12">
              <h2 className="font-heading text-xl font-bold text-primary sm:text-2xl md:text-4xl">
                {slide.title}
              </h2>
              <div className="whitespace-pre-line text-sm leading-relaxed text-foreground sm:text-base md:text-lg">
                {slide.content}
              </div>
            </div>
          )}

          {!isFirst && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onPrev}
              aria-label="Previous slide"
              className={cn(overlayButtonClassName, 'left-3')}
            >
              <ChevronLeft size={22} />
            </Button>
          )}
          {!isLast && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onNext}
              aria-label="Next slide"
              className={cn(overlayButtonClassName, 'right-3')}
            >
              <ChevronRight size={22} />
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">This slide deck has no slides yet.</p>
      )}
    </div>
  );
};
