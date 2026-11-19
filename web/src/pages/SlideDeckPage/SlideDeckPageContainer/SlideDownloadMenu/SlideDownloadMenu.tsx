import React from 'react';
import { Download, FileArchive, ImageDown } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { Spinner } from '../../../../components/ui/Spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../components/ui/DropdownMenu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../components/ui/Tooltip';
import { cn } from '../../../../lib/utils';
import { ISlideDownloadMenu } from './ISlideDownloadMenu';

export const SlideDownloadMenu: React.FC<ISlideDownloadMenu> = ({
  isDownloading,
  progress,
  hasAnyImage,
  canDownloadCurrent,
  handleDownloadAll,
  handleDownloadCurrent,
}) => {
  const busyLabel =
    progress && progress.total > 0
      ? `Preparing ${progress.done}/${progress.total}…`
      : 'Preparing…';

  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isDownloading || !hasAnyImage}
      aria-label={isDownloading ? busyLabel : 'Download slide images'}
      className="shrink-0 gap-1.5 px-3"
    >
      {isDownloading ? <Spinner size="sm" /> : <Download size={16} aria-hidden />}
      <span className={cn(!isDownloading && 'hidden sm:inline')}>
        {isDownloading ? busyLabel : 'Download'}
      </span>
    </Button>
  );

  if (!hasAnyImage) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Disabled buttons swallow pointer events, so the tooltip anchors on a wrapper. */}
          <span tabIndex={0} className="inline-flex rounded-full">
            {trigger}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">No slide images to download</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleDownloadAll}>
          <FileArchive size={16} className="mr-2 shrink-0" aria-hidden />
          All images (.zip)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadCurrent} disabled={!canDownloadCurrent}>
          <ImageDown size={16} className="mr-2 shrink-0" aria-hidden />
          Current slide image
          {!canDownloadCurrent && (
            <span className="ml-2 text-xs text-muted-foreground">No image</span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
