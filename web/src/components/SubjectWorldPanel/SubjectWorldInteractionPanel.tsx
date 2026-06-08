import React, { useMemo } from 'react';
import {
  SubjectWorldDialogueButton,
  SubjectWorldDialogueNode,
  SubjectWorldGate,
  SubjectWorldNpc,
  SubjectWorldPoi,
} from '@shared-types';
import { SubjectWorldGateAnswerFeedback } from '../../store/slices/subjectWorldPageSlice';
import { findDialogueNodeById } from '../../pages/SubjectWorldPage/utils/subjectWorldDialogueUtils';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { cn } from '../../lib/utils';

interface ISubjectWorldInteractionPanelProps {
  poi: SubjectWorldPoi | null;
  gate: SubjectWorldGate | null;
  npc: SubjectWorldNpc | null;
  activeDialogueNodeId: string | null;
  selectedGateAnswer: number | null;
  gateAnswerFeedback: SubjectWorldGateAnswerFeedback;
  onClose: () => void;
  onSelectGateAnswer: (index: number) => void;
  onSubmitGateAnswer: () => void;
  onDialogueButton: (button: SubjectWorldDialogueButton) => void;
  onAskForgeHint?: () => void;
}

function resolveActiveDialogueNode(
  npc: SubjectWorldNpc,
  activeDialogueNodeId: string | null
): SubjectWorldDialogueNode | null {
  if (activeDialogueNodeId) {
    return findDialogueNodeById(npc, activeDialogueNodeId);
  }
  return npc.dialogue[0] ?? null;
}

export const SubjectWorldInteractionPanel: React.FC<ISubjectWorldInteractionPanelProps> = ({
  poi,
  gate,
  npc,
  activeDialogueNodeId,
  selectedGateAnswer,
  gateAnswerFeedback,
  onClose,
  onSelectGateAnswer,
  onSubmitGateAnswer,
  onDialogueButton,
  onAskForgeHint,
}) => {
  const dialogueNode = useMemo(
    () => (npc ? resolveActiveDialogueNode(npc, activeDialogueNodeId) : null),
    [activeDialogueNodeId, npc]
  );

  if (!poi && !gate && !npc) return null;

  const gateTypeLabel =
    gate?.type === 'door'
      ? gateAnswerFeedback === 'correct'
        ? 'Door opened!'
        : 'Locked door'
      : gate?.type === 'bridge'
        ? gateAnswerFeedback === 'correct'
          ? 'Bridge lowered!'
          : 'Blocked bridge'
        : null;

  return (
    <div className="absolute inset-y-0 right-0 z-20 w-full max-w-md border-l border-border bg-background/95 p-4 backdrop-blur">
      <Card className="h-full border-0 bg-transparent shadow-none">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 px-0">
          <CardTitle>{poi?.label ?? gate?.label ?? npc?.label}</CardTitle>
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
              {poi.type === 'collectible' && (
                <p className="text-xs font-medium text-yellow-500">Added to your inventory</p>
              )}
            </>
          )}
          {npc && dialogueNode && (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Guide</p>
              <p className="text-sm leading-relaxed">{dialogueNode.text}</p>
              {dialogueNode.buttons && dialogueNode.buttons.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {dialogueNode.buttons.map((button, index) => (
                    <Button
                      key={`${dialogueNode.id}-${index}`}
                      variant="outline"
                      size="sm"
                      onClick={() => onDialogueButton(button)}
                    >
                      {button.label}
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}
          {gate && (
            <>
              {gateTypeLabel && (
                <p className="text-xs font-medium text-muted-foreground">{gateTypeLabel}</p>
              )}
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
                  <p className="font-medium">
                    {gate.type === 'door'
                      ? 'The door stays locked — try again.'
                      : gate.type === 'bridge'
                        ? 'The bridge is still blocked — try again.'
                        : 'Not quite — try again.'}
                  </p>
                  {gate.explanation && (
                    <p className="mt-1 text-destructive/90">{gate.explanation}</p>
                  )}
                  {onAskForgeHint && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={onAskForgeHint}
                    >
                      Ask Forge for a hint
                    </Button>
                  )}
                </div>
              )}
              <Button
                className="w-full"
                disabled={selectedGateAnswer === null}
                onClick={onSubmitGateAnswer}
              >
                {gate.type === 'door'
                  ? 'Try key'
                  : gate.type === 'bridge'
                    ? 'Try crossing'
                    : 'Submit answer'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
