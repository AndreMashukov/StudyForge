import React from 'react';
import { ArrowLeft, Maximize2, Minimize2, Presentation } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../components/ui/Tooltip';
import { cn } from '../../../../lib/utils';
import { SlideDownloadMenu } from '../SlideDownloadMenu';
import { ISlideDeckHeader } from './ISlideDeckHeader';

export const SlideDeckHeader: React.FC<ISlideDeckHeader> = ({
  title,
  currentIndex,
  total,
  isFullscreen,
  download,
  onNavigateBack,
  onToggleFullscreen,
}) => {
  const fullscreenLabel = isFullscreen ? 'Exit fullscreen' : 'View fullscreen';

  return (
    <TooltipProvider>
      <header
        className={cn(
          'flex shrink-0 items-center gap-2 border-b border-border bg-background py-2.5',
          isFullscreen ? 'px-4' : 'px-3 md:px-0'
        )}
      >
        {!isFullscreen && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onNavigateBack}
            aria-label="Back to directory"
            className="shrink-0 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={20} aria-hidden />
            <span className="hidden text-sm sm:inline">Back to directory</span>
          </Button>
        )}

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Presentation size={18} className="shrink-0 text-muted-foreground" aria-hidden />
          <h1 className="truncate text-sm font-semibold sm:text-lg">{title}</h1>
        </div>

        <span className="shrink-0 text-sm tabular-nums text-muted-foreground" aria-live="polite">
          {total > 0 ? `${currentIndex + 1} / ${total}` : 'No slides'}
        </span>

        <SlideDownloadMenu {...download} />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={onToggleFullscreen}
              aria-label={fullscreenLabel}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{fullscreenLabel}</TooltipContent>
        </Tooltip>
      </header>
    </TooltipProvider>
  );
};
