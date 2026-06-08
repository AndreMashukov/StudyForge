import React from 'react';
import { SubjectWorldGate, SubjectWorldPoi } from '@shared-types';
import { SubjectWorldGateAnswerFeedback } from '../../store/slices/subjectWorldPageSlice';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { cn } from '../../lib/utils';

interface ISubjectWorldInteractionPanelProps {
  poi: SubjectWorldPoi | null;
  gate: SubjectWorldGate | null;
  selectedGateAnswer: number | null;
  gateAnswerFeedback: SubjectWorldGateAnswerFeedback;
  onClose: () => void;
  onSelectGateAnswer: (index: number) => void;
  onSubmitGateAnswer: () => void;
}

export const SubjectWorldInteractionPanel: React.FC<ISubjectWorldInteractionPanelProps> = ({
  poi,
  gate,
  selectedGateAnswer,
  gateAnswerFeedback,
  onClose,
  onSelectGateAnswer,
  onSubmitGateAnswer,
}) => {
  if (!poi && !gate) return null;

  return (
    <div className="absolute inset-y-0 right-0 z-20 w-full max-w-md border-l border-border bg-background/95 p-4 backdrop-blur">
      <Card className="h-full border-0 bg-transparent shadow-none">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 px-0">
          <CardTitle>{poi?.label ?? gate?.label}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto px-0 pb-0">
          {poi && (
            <>
              <p className="text-sm text-muted-foreground">{poi.summary}</p>
              <MarkdownRenderer content={poi.fullExcerpt} />
              <p className="text-xs text-muted-foreground">
                Source: {poi.sourceRef.sectionHeading}
              </p>
            </>
          )}
          {gate && (
            <>
              <p className="font-medium">{gate.question}</p>
              <div className="space-y-2">
                {gate.options.map((option, index) => (
                  <Button
                    key={index}
                    variant={selectedGateAnswer === index ? 'default' : 'outline'}
                    className={cn(
                      'w-full justify-start',
                      gateAnswerFeedback === 'wrong' &&
                        selectedGateAnswer === index &&
                        'border-destructive ring-1 ring-destructive'
                    )}
                    onClick={() => onSelectGateAnswer(index)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
              {gateAnswerFeedback === 'wrong' && (
                <div
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  <p className="font-medium">Not quite — try again.</p>
                  {gate.explanation && (
                    <p className="mt-1 text-destructive/90">{gate.explanation}</p>
                  )}
                </div>
              )}
              <Button
                className="w-full"
                disabled={selectedGateAnswer === null}
                onClick={onSubmitGateAnswer}
              >
                Submit answer
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
