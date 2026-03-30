import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { MermaidDiagram } from '../../../../components/MermaidDiagram';
import { cn } from '../../../../lib/utils';
import { IDiagramSlideViewer } from './IDiagramSlideViewer';

const LABELS = ['A', 'B', 'C', 'D'];

export const DiagramSlideViewer: React.FC<IDiagramSlideViewer> = ({
  diagrams,
  currentIndex,
  onPrev,
  onNext,
  onDotClick,
  className,
}) => {
  const safeIndex = Math.min(Math.max(0, currentIndex), diagrams.length - 1);
  const code = diagrams[safeIndex] ?? '';

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative">
        <div className="absolute left-3 top-3 z-10 rounded-md border border-border bg-background/90 px-2 py-1 text-xs font-semibold text-primary backdrop-blur">
          Option {LABELS[safeIndex]}
        </div>
        <Card className="overflow-hidden border-2">
          <div className="aspect-video w-full min-h-[200px]">
            <MermaidDiagram code={code} className="h-full min-h-[200px] border-0 bg-transparent" />
          </div>
        </Card>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <Button
          type="button"
          variant="outline"
          onClick={onPrev}
          disabled={safeIndex === 0}
          className="px-3 sm:px-4"
        >
          <ChevronLeft size={20} />
          <span className="ml-1 hidden sm:inline">Prev</span>
        </Button>
        <div className="flex flex-wrap justify-center gap-1.5">
          {diagrams.slice(0, 4).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onDotClick(i)}
              aria-label={`Show diagram ${LABELS[i]}`}
              className={cn(
                'h-2.5 w-2.5 rounded-full transition-colors',
                i === safeIndex ? 'bg-primary' : 'bg-muted hover:bg-muted-foreground/30'
              )}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onNext}
          disabled={safeIndex >= diagrams.length - 1}
          className="px-3 sm:px-4"
        >
          <span className="mr-1 hidden sm:inline">Next</span>
          <ChevronRight size={20} />
        </Button>
      </div>
    </div>
  );
};
