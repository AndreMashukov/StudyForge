import React, { useState } from 'react';
import { cn } from '../../../../lib/utils';
import { ISlideThumbnail } from './ISlideThumbnail';

export const SlideThumbnail: React.FC<ISlideThumbnail> = ({ slide, index, isActive, onSelect }) => {
  const slideNumber = index + 1;
  // Fall back to the title card when the image is missing from Storage.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageUrl = slide.imageUrl && slide.imageUrl !== failedSrc ? slide.imageUrl : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      aria-label={`Slide ${slideNumber}: ${slide.title}`}
      aria-current={isActive ? 'true' : undefined}
      className={cn(
        'group flex w-28 items-start gap-1.5 rounded-md p-1 text-left lg:w-full',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      <span
        className={cn(
          'w-5 shrink-0 pt-0.5 text-right text-xs tabular-nums',
          isActive ? 'font-semibold text-primary' : 'text-muted-foreground'
        )}
        aria-hidden
      >
        {slideNumber}
      </span>
      <span
        className={cn(
          'relative block aspect-video min-w-0 flex-1 overflow-hidden rounded border bg-muted transition-shadow',
          isActive
            ? 'border-primary ring-2 ring-primary'
            : 'border-border group-hover:border-muted-foreground/50'
        )}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setFailedSrc(imageUrl)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center bg-card p-1 text-center">
            <span className="line-clamp-3 text-[10px] font-medium leading-tight text-muted-foreground">
              {slide.title}
            </span>
          </span>
        )}
      </span>
    </button>
  );
};
