import React from 'react';
import { SubjectWorldPoi } from '@shared-types';
import { Button } from '../ui/Button';

interface ISubjectWorldRecallCardProps {
  recallQuestion: string;
  recallContext: string;
  onDismiss: () => void;
  onAskForge: () => void;
}

export const SubjectWorldRecallCard: React.FC<ISubjectWorldRecallCardProps> = ({
  recallQuestion,
  recallContext,
  onDismiss,
  onAskForge,
}) => (
  <div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex justify-center px-4">
    <div className="pointer-events-auto w-full max-w-lg rounded-lg border border-primary/40 bg-background/95 p-4 shadow-xl backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">Quick recall</p>
      <p className="mt-2 text-sm font-medium">{recallQuestion}</p>
      <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{recallContext}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={onAskForge}>
          Ask Forge to quiz me
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  </div>
);

export function buildRecallPrompt(
  gateQuestion: string,
  gateExcerpt: string,
  selectedOption?: string
): string {
  const parts = [
    `I'm revisiting a subject world I already completed. Help me recall this concept with a short follow-up question.`,
    `Gate question: ${gateQuestion}`,
  ];
  if (selectedOption) {
    parts.push(`I previously chose: ${selectedOption}`);
  }
  if (gateExcerpt.trim()) {
    parts.push(`Source excerpt: ${gateExcerpt.trim()}`);
  }
  return parts.join('\n\n');
}

export function pickRecallSource(
  pois: SubjectWorldPoi[],
  visitedPoiIds: string[],
  gateQuestion: string,
  gateExcerpt: string
): { question: string; context: string } {
  const visitedPoi = pois.find((poi) => visitedPoiIds.includes(poi.id));
  if (visitedPoi) {
    return {
      question: `Can you still explain: ${visitedPoi.label}?`,
      context: visitedPoi.summary || visitedPoi.fullExcerpt.slice(0, 160),
    };
  }

  return {
    question: gateQuestion,
    context: gateExcerpt.slice(0, 160),
  };
}
